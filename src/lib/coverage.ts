// Coverage analysis utilities for blindspot detection and spectrum visualization
import { Article } from './db'

export type Orientation = 'left' | 'center-left' | 'center' | 'center-right' | 'right' | 'state'

export interface CoverageSpectrum {
  left: number      // Count of left + center-left sources
  center: number    // Count of center sources
  right: number     // Count of right + center-right sources
  state: number     // Count of state-affiliated sources
  total: number
  countries: string[]
  sources: string[]
}

export interface BlindspotInfo {
  type: 'left-blindspot' | 'right-blindspot' | 'center-only' | 'state-only' | 'balanced' | 'unknown'
  severity: 'high' | 'medium' | 'low' | 'none'
  description: string
  missingPerspectives: string[]
}

export interface StoryClusterAnalysis {
  clusterId: string
  clusterName: string
  articles: Article[]
  spectrum: CoverageSpectrum
  blindspot: BlindspotInfo
  importanceScore: number
  oldestArticle: Date
  newestArticle: Date
  coverageSpanHours: number
}

// Calculate coverage spectrum for a group of articles
export function calculateCoverageSpectrum(articles: Article[]): CoverageSpectrum {
  const spectrum: CoverageSpectrum = {
    left: 0,
    center: 0,
    right: 0,
    state: 0,
    total: articles.length,
    countries: [],
    sources: []
  }

  const countriesSet = new Set<string>()
  const sourcesSet = new Set<string>()

  for (const article of articles) {
    countriesSet.add(article.country)
    sourcesSet.add(article.source)

    switch (article.orientation) {
      case 'left':
      case 'center-left':
        spectrum.left++
        break
      case 'center':
        spectrum.center++
        break
      case 'center-right':
      case 'right':
        spectrum.right++
        break
      case 'state':
        spectrum.state++
        break
    }
  }

  spectrum.countries = Array.from(countriesSet)
  spectrum.sources = Array.from(sourcesSet)

  return spectrum
}

// Detect blindspots in coverage
export function detectBlindspot(spectrum: CoverageSpectrum): BlindspotInfo {
  const { left, center, right, state, total } = spectrum

  // If only state media is covering
  if (state > 0 && left === 0 && center === 0 && right === 0) {
    return {
      type: 'state-only',
      severity: 'high',
      description: 'Only state-affiliated media covering this story',
      missingPerspectives: ['Independent left', 'Center', 'Independent right']
    }
  }

  // Calculate percentages (excluding state media for political balance)
  const independentTotal = left + center + right
  if (independentTotal === 0) {
    return {
      type: 'unknown',
      severity: 'none',
      description: 'Insufficient coverage data',
      missingPerspectives: []
    }
  }

  const leftPct = left / independentTotal
  const centerPct = center / independentTotal
  const rightPct = right / independentTotal

  // Check for blindspots
  const missingPerspectives: string[] = []

  if (left === 0) missingPerspectives.push('Left-leaning sources')
  if (center === 0) missingPerspectives.push('Centrist sources')
  if (right === 0) missingPerspectives.push('Right-leaning sources')

  // Left blindspot: primarily right-leaning coverage
  if (rightPct > 0.7 && left === 0) {
    return {
      type: 'left-blindspot',
      severity: leftPct === 0 ? 'high' : 'medium',
      description: 'Left-leaning media not covering this story',
      missingPerspectives
    }
  }

  // Right blindspot: primarily left-leaning coverage
  if (leftPct > 0.7 && right === 0) {
    return {
      type: 'right-blindspot',
      severity: rightPct === 0 ? 'high' : 'medium',
      description: 'Right-leaning media not covering this story',
      missingPerspectives
    }
  }

  // Center-only coverage
  if (centerPct > 0.8 && left === 0 && right === 0) {
    return {
      type: 'center-only',
      severity: 'medium',
      description: 'Only centrist media covering this story',
      missingPerspectives
    }
  }

  // Check for moderate imbalance
  if (leftPct > 0.6 && right === 0) {
    return {
      type: 'right-blindspot',
      severity: 'low',
      description: 'Limited right-leaning coverage',
      missingPerspectives
    }
  }

  if (rightPct > 0.6 && left === 0) {
    return {
      type: 'left-blindspot',
      severity: 'low',
      description: 'Limited left-leaning coverage',
      missingPerspectives
    }
  }

  // Balanced coverage
  return {
    type: 'balanced',
    severity: 'none',
    description: 'Balanced coverage across political spectrum',
    missingPerspectives
  }
}

// Calculate importance score for a story cluster
export function calculateImportanceScore(articles: Article[]): number {
  if (articles.length === 0) return 0

  const spectrum = calculateCoverageSpectrum(articles)

  // Factors for importance:
  // 1. Coverage breadth (number of sources) - max 40 points
  const sourceFactor = Math.min(spectrum.sources.length * 5, 40)

  // 2. Geographic spread (number of countries) - max 30 points
  const countryFactor = Math.min(spectrum.countries.length * 10, 30)

  // 3. Political diversity (coverage across spectrum) - max 20 points
  const diversityCount = [spectrum.left > 0, spectrum.center > 0, spectrum.right > 0].filter(Boolean).length
  const diversityFactor = diversityCount * 7

  // 4. Recency - max 10 points (decays over 48 hours)
  const newestDate = new Date(Math.max(...articles.map(a => new Date(a.publishedAt).getTime())))
  const hoursAgo = (Date.now() - newestDate.getTime()) / (1000 * 60 * 60)
  const recencyFactor = Math.max(0, 10 - (hoursAgo / 4.8)) // Decays to 0 over 48 hours

  return Math.round(sourceFactor + countryFactor + diversityFactor + recencyFactor)
}

// Analyze a story cluster
export function analyzeStoryCluster(
  clusterId: string,
  clusterName: string,
  articles: Article[]
): StoryClusterAnalysis {
  const spectrum = calculateCoverageSpectrum(articles)
  const blindspot = detectBlindspot(spectrum)
  const importanceScore = calculateImportanceScore(articles)

  const dates = articles.map(a => new Date(a.publishedAt).getTime())
  const oldestArticle = new Date(Math.min(...dates))
  const newestArticle = new Date(Math.max(...dates))
  const coverageSpanHours = (newestArticle.getTime() - oldestArticle.getTime()) / (1000 * 60 * 60)

  return {
    clusterId,
    clusterName,
    articles,
    spectrum,
    blindspot,
    importanceScore,
    oldestArticle,
    newestArticle,
    coverageSpanHours
  }
}

// Get relative time string
export function getRelativeTime(date: Date | string): string {
  const now = new Date()
  const then = typeof date === 'string' ? new Date(date) : date
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return then.toLocaleDateString()
}

// Get freshness class for styling
export function getFreshnessClass(date: Date | string): 'fresh' | 'recent' | 'stale' {
  const then = typeof date === 'string' ? new Date(date) : date
  const hoursAgo = (Date.now() - then.getTime()) / (1000 * 60 * 60)

  if (hoursAgo < 6) return 'fresh'
  if (hoursAgo < 24) return 'recent'
  return 'stale'
}

// Timeline data point for coverage graph
export interface TimelineDataPoint {
  date: string // ISO date string (day precision)
  count: number
  leftCount: number
  centerCount: number
  rightCount: number
  stateCount: number
  articles: Article[]
}

// Generate timeline data for articles
export function generateTimelineData(
  articles: Article[],
  granularity: 'day' | 'week' | 'month' = 'day'
): TimelineDataPoint[] {
  const dataMap = new Map<string, TimelineDataPoint>()

  for (const article of articles) {
    const date = new Date(article.publishedAt)
    let key: string

    if (granularity === 'day') {
      key = date.toISOString().split('T')[0]
    } else if (granularity === 'week') {
      // Get Monday of the week
      const monday = new Date(date)
      monday.setDate(date.getDate() - date.getDay() + 1)
      key = monday.toISOString().split('T')[0]
    } else {
      // Month
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
    }

    if (!dataMap.has(key)) {
      dataMap.set(key, {
        date: key,
        count: 0,
        leftCount: 0,
        centerCount: 0,
        rightCount: 0,
        stateCount: 0,
        articles: []
      })
    }

    const point = dataMap.get(key)!
    point.count++
    point.articles.push(article)

    switch (article.orientation) {
      case 'left':
      case 'center-left':
        point.leftCount++
        break
      case 'center':
        point.centerCount++
        break
      case 'center-right':
      case 'right':
        point.rightCount++
        break
      case 'state':
        point.stateCount++
        break
    }
  }

  return Array.from(dataMap.values()).sort((a, b) => a.date.localeCompare(b.date))
}

// Filter articles by date range
export function filterArticlesByDateRange(
  articles: Article[],
  startDate: Date | null,
  endDate: Date | null
): Article[] {
  return articles.filter(article => {
    const date = new Date(article.publishedAt)
    if (startDate && date < startDate) return false
    if (endDate && date > endDate) return false
    return true
  })
}
