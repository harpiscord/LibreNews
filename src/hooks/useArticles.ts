import { useState, useCallback } from 'react'
import { Article, saveArticle, getAllArticles, getSavedArticles, deleteArticle, getArticle } from '../lib/db'
import { translateContent, analyzeBias, assessTrustScore, detectFakeNews, summarizeArticle } from '../lib/claude'
import { getCountryByCode, Newspaper } from '../lib/countries'

// Generate a simple cluster name from article titles (no API call)
function generateSimpleClusterName(titles: string[]): string {
  if (titles.length === 0) return 'Related Stories'

  // Find common significant words across titles
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'that', 'this', 'these', 'those', 'it', 'its', "it's", 'they', 'their', 'them', 'we', 'our', 'us', 'i', 'me', 'my', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'who', 'what', 'which', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'new', 'says', 'said', 'after', 'before', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'any', 'about'])

  const wordCounts: Record<string, number> = {}

  for (const title of titles) {
    const words = title.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/)
    const seen = new Set<string>()
    for (const word of words) {
      if (word.length > 3 && !stopWords.has(word) && !seen.has(word)) {
        wordCounts[word] = (wordCounts[word] || 0) + 1
        seen.add(word)
      }
    }
  }

  // Find words that appear in multiple titles
  const commonWords = Object.entries(wordCounts)
    .filter(([_, count]) => count >= Math.min(2, titles.length))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1))

  if (commonWords.length > 0) {
    return commonWords.join(' ')
  }

  // Fallback: use first few significant words from first title
  const firstTitle = titles[0]
  const words = firstTitle.split(/\s+/).slice(0, 5).join(' ')
  return words.length > 40 ? words.substring(0, 40) + '...' : words
}

declare global {
  interface Window {
    electronAPI: {
      rss: {
        fetch: (feeds: Array<{
          rssUrl: string
          sourceName: string
          country: string
          orientation: string
          language: string
          trustworthiness: number
          factCheckRecord: string
        }>) => Promise<Array<{
          title: string
          content: string
          url: string
          source: string
          country: string
          orientation: string
          originalLanguage: string
          publishedAt: string
          trustworthiness: number
          factCheckRecord: string
          topic: string
          topicConfidence: number
          clusterId: string
          trendingScore: number
          isTrending: boolean
        }>>
      }
      anthropic: any
    }
  }
}

export function useArticles() {
  const [articles, setArticles] = useState<Article[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [fetchProgress, setFetchProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)

  const loadArticles = useCallback(async () => {
    setIsLoading(true)
    try {
      const all = await getAllArticles()
      setArticles(all)
    } catch (err) {
      setError(String(err))
    }
    setIsLoading(false)
  }, [])

  const loadSavedArticles = useCallback(async () => {
    setIsLoading(true)
    try {
      const saved = await getSavedArticles()
      setArticles(saved)
    } catch (err) {
      setError(String(err))
    }
    setIsLoading(false)
  }, [])

  const fetchNews = useCallback(async (selectedCountries: string[]) => {
    if (selectedCountries.length === 0) {
      setError('No countries selected')
      return
    }

    setIsFetching(true)
    setError(null)

    // Build list of feeds to fetch
    const feeds: Array<{
      rssUrl: string
      sourceName: string
      country: string
      orientation: string
      language: string
      trustworthiness: number
      factCheckRecord: string
    }> = []

    for (const countryCode of selectedCountries) {
      const country = getCountryByCode(countryCode)
      if (country) {
        for (const paper of country.newspapers) {
          feeds.push({
            rssUrl: paper.rssUrl,
            sourceName: paper.name,
            country: countryCode,
            orientation: paper.orientation,
            language: paper.language,
            trustworthiness: paper.trustworthiness,
            factCheckRecord: paper.factCheckRecord,
          })
        }
      }
    }

    setFetchProgress({ current: 0, total: feeds.length })

    try {
      const rawArticles = await window.electronAPI.rss.fetch(feeds)

      // Get existing article URLs to avoid duplicates
      const existingUrls = new Set(articles.map(a => a.url))

      // Group raw articles by clusterId to generate names
      const clusterTitles: Record<string, string[]> = {}
      for (const raw of rawArticles) {
        if (raw.clusterId) {
          if (!clusterTitles[raw.clusterId]) {
            clusterTitles[raw.clusterId] = []
          }
          clusterTitles[raw.clusterId].push(raw.title)
        }
      }

      // Generate cluster names for each cluster
      const clusterNames: Record<string, string> = {}
      for (const [clusterId, titles] of Object.entries(clusterTitles)) {
        if (titles.length > 1) {
          clusterNames[clusterId] = generateSimpleClusterName(titles)
        }
      }

      let added = 0
      for (const raw of rawArticles) {
        if (!existingUrls.has(raw.url)) {
          const newArticle: Article = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: raw.title,
            content: raw.content,
            url: raw.url,
            source: raw.source,
            country: raw.country,
            orientation: raw.orientation as Article['orientation'],
            originalLanguage: raw.originalLanguage,
            publishedAt: raw.publishedAt,
            fetchedAt: new Date().toISOString(),
            saved: false,
            trustScore: raw.trustworthiness,
            topic: raw.topic as Article['topic'],
            topicConfidence: raw.topicConfidence,
            clusterId: raw.clusterId,
            clusterName: raw.clusterId ? clusterNames[raw.clusterId] : undefined,
            trendingScore: raw.trendingScore,
            isTrending: raw.isTrending,
          }
          await saveArticle(newArticle)
          added++
        }
      }

      // Reload all articles
      const all = await getAllArticles()
      setArticles(all)
      setFetchProgress({ current: feeds.length, total: feeds.length })

    } catch (err) {
      setError(String(err))
    }

    setIsFetching(false)
  }, [articles])

  const addArticle = useCallback(async (article: Omit<Article, 'id' | 'fetchedAt' | 'saved'>) => {
    const newArticle: Article = {
      ...article,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fetchedAt: new Date().toISOString(),
      saved: false,
    }
    await saveArticle(newArticle)
    setArticles(prev => [newArticle, ...prev])
    return newArticle
  }, [])

  const toggleSaved = useCallback(async (articleId: string) => {
    const article = await getArticle(articleId)
    if (article) {
      const updated = { ...article, saved: !article.saved }
      await saveArticle(updated)
      setArticles(prev => prev.map(a => a.id === articleId ? updated : a))
    }
  }, [])

  const removeArticle = useCallback(async (articleId: string) => {
    await deleteArticle(articleId)
    setArticles(prev => prev.filter(a => a.id !== articleId))
  }, [])

  const translateArticle = useCallback(async (articleId: string, targetLanguage: string) => {
    const article = await getArticle(articleId)
    if (!article) return

    setIsLoading(true)
    try {
      const translated = await translateContent(article.content, article.originalLanguage, targetLanguage)
      const updated = { ...article, translatedContent: translated, targetLanguage }
      await saveArticle(updated)
      setArticles(prev => prev.map(a => a.id === articleId ? updated : a))
    } catch (err) {
      setError(String(err))
    }
    setIsLoading(false)
  }, [])

  const analyzeArticleBias = useCallback(async (articleId: string) => {
    const article = await getArticle(articleId)
    if (!article) return

    setIsLoading(true)
    try {
      const bias = await analyzeBias(article.content, article.source)
      const updated = { ...article, biasAnalysis: bias }
      await saveArticle(updated)
      setArticles(prev => prev.map(a => a.id === articleId ? updated : a))
      return bias
    } catch (err) {
      setError(String(err))
    }
    setIsLoading(false)
  }, [])

  const assessArticleTrust = useCallback(async (articleId: string) => {
    const article = await getArticle(articleId)
    if (!article) return

    setIsLoading(true)
    try {
      const trust = await assessTrustScore(article.content, article.source)
      const updated = { ...article, trustScore: trust.score }
      await saveArticle(updated)
      setArticles(prev => prev.map(a => a.id === articleId ? updated : a))
      return trust
    } catch (err) {
      setError(String(err))
    }
    setIsLoading(false)
  }, [])

  const checkFakeNews = useCallback(async (articleId: string) => {
    const article = await getArticle(articleId)
    if (!article) return

    setIsLoading(true)
    try {
      const result = await detectFakeNews(article.content)
      return result
    } catch (err) {
      setError(String(err))
    }
    setIsLoading(false)
  }, [])

  const summarize = useCallback(async (articleId: string) => {
    const article = await getArticle(articleId)
    if (!article) return

    setIsLoading(true)
    try {
      const summary = await summarizeArticle(article.content)
      return summary
    } catch (err) {
      setError(String(err))
    }
    setIsLoading(false)
  }, [])

  const updateArticle = useCallback(async (articleId: string, updates: Partial<Article>) => {
    const article = await getArticle(articleId)
    if (!article) return

    const updated = { ...article, ...updates }
    await saveArticle(updated)
    setArticles(prev => prev.map(a => a.id === articleId ? updated : a))
    return updated
  }, [])

  return {
    articles,
    isLoading,
    isFetching,
    fetchProgress,
    error,
    loadArticles,
    loadSavedArticles,
    fetchNews,
    addArticle,
    toggleSaved,
    removeArticle,
    translateArticle,
    analyzeArticleBias,
    assessArticleTrust,
    checkFakeNews,
    summarize,
    updateArticle,
  }
}
