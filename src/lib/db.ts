// IndexedDB wrapper for persistent local storage
import { openDB, DBSchema, IDBPDatabase } from 'idb'

export type Topic = 'politics' | 'international' | 'cybersecurity' | 'economy' | 'military' | 'energy' | 'technology' | 'health' | 'environment' | 'other'

export interface Article {
  id: string
  title: string
  content: string
  source: string
  country: string
  orientation: 'left' | 'center-left' | 'center' | 'center-right' | 'right' | 'state'
  originalLanguage: string
  translatedContent?: string
  translatedTitle?: string // Translated headline
  targetLanguage?: string
  url: string
  imageUrl?: string // Article thumbnail/featured image
  publishedAt: string
  fetchedAt: string
  biasAnalysis?: BiasAnalysis
  trustScore?: number
  fakeNewsScore?: number
  imageAnalysis?: ImageAnalysis // Analysis of article images for manipulation/misleading content
  topic?: Topic
  topicConfidence?: number
  clusterId?: string // For grouping related articles
  clusterName?: string // User-defined or auto-generated name for the cluster/group
  trendingScore?: number // Score based on cross-source coverage
  isTrending?: boolean // Whether this story is trending across sources
  saved: boolean
}

export interface ImageAnalysis {
  isManipulated: boolean
  manipulationScore: number // 0-100
  misleadingScore: number // 0-100 - how misleading is the image in context
  findings: string[]
  explanation: string
}

export interface BiasAnalysis {
  score: number // -1 (left) to 1 (right)
  confidence: number
  explanation: string
  indicators: string[]
}

export interface Insight {
  id: string
  articleId: string
  type: 'bias' | 'trust' | 'fakeness' | 'summary'
  content: string
  createdAt: string
}

export interface Correlation {
  id: string
  articleIds: string[]
  topic: string
  analysis: string
  countries: string[]
  createdAt: string
}

export interface ClaudeRequest {
  id: string
  timestamp: string
  prompt: string
  model: string
  maxTokens: number
}

export interface ClaudeResponse {
  id: string
  requestId: string
  timestamp: string
  content: string
  inputTokens: number
  outputTokens: number
  costUSD: number // Calculated cost in USD
  operation: string // What operation this was (translate, analyze, correlate, etc.)
}

export interface UserPreferences {
  id: string
  targetLanguage: string
  selectedCountries: string[]
  theme: 'light' | 'dark' | 'system'
  autoTranslate: boolean
  showBiasIndicators: boolean
  // Cost control settings
  autoAnalyzeBias: boolean
  autoAssessTrust: boolean
  autoDetectFakeNews: boolean
  autoAnalyzeImages: boolean
  autoTranslateOnFetch: boolean
}

interface LibreNewsDB extends DBSchema {
  articles: {
    key: string
    value: Article
    indexes: {
      'by-country': string
      'by-date': string
      'by-saved': number
    }
  }
  insights: {
    key: string
    value: Insight
    indexes: {
      'by-article': string
      'by-type': string
    }
  }
  correlations: {
    key: string
    value: Correlation
    indexes: {
      'by-date': string
    }
  }
  claudeRequests: {
    key: string
    value: ClaudeRequest
    indexes: {
      'by-date': string
    }
  }
  claudeResponses: {
    key: string
    value: ClaudeResponse
    indexes: {
      'by-request': string
    }
  }
  preferences: {
    key: string
    value: UserPreferences
  }
}

let db: IDBPDatabase<LibreNewsDB> | null = null

export async function initDB(): Promise<IDBPDatabase<LibreNewsDB>> {
  if (db) return db

  db = await openDB<LibreNewsDB>('librenews', 1, {
    upgrade(database) {
      // Articles store
      const articlesStore = database.createObjectStore('articles', { keyPath: 'id' })
      articlesStore.createIndex('by-country', 'country')
      articlesStore.createIndex('by-date', 'fetchedAt')
      articlesStore.createIndex('by-saved', 'saved')

      // Insights store
      const insightsStore = database.createObjectStore('insights', { keyPath: 'id' })
      insightsStore.createIndex('by-article', 'articleId')
      insightsStore.createIndex('by-type', 'type')

      // Correlations store
      const correlationsStore = database.createObjectStore('correlations', { keyPath: 'id' })
      correlationsStore.createIndex('by-date', 'createdAt')

      // Claude requests store (for transparency logging)
      const requestsStore = database.createObjectStore('claudeRequests', { keyPath: 'id' })
      requestsStore.createIndex('by-date', 'timestamp')

      // Claude responses store
      const responsesStore = database.createObjectStore('claudeResponses', { keyPath: 'id' })
      responsesStore.createIndex('by-request', 'requestId')

      // Preferences store
      database.createObjectStore('preferences', { keyPath: 'id' })
    },
  })

  return db
}

// Article operations
export async function saveArticle(article: Article): Promise<void> {
  const database = await initDB()
  await database.put('articles', article)
}

export async function getArticle(id: string): Promise<Article | undefined> {
  const database = await initDB()
  return database.get('articles', id)
}

export async function getAllArticles(): Promise<Article[]> {
  const database = await initDB()
  return database.getAll('articles')
}

export async function getSavedArticles(): Promise<Article[]> {
  const database = await initDB()
  const all = await database.getAll('articles')
  return all.filter(a => a.saved)
}

export async function getArticlesByCountry(country: string): Promise<Article[]> {
  const database = await initDB()
  return database.getAllFromIndex('articles', 'by-country', country)
}

export async function deleteArticle(id: string): Promise<void> {
  const database = await initDB()
  await database.delete('articles', id)
}

// Insight operations
export async function saveInsight(insight: Insight): Promise<void> {
  const database = await initDB()
  await database.put('insights', insight)
}

export async function getInsightsForArticle(articleId: string): Promise<Insight[]> {
  const database = await initDB()
  return database.getAllFromIndex('insights', 'by-article', articleId)
}

// Correlation operations
export async function saveCorrelation(correlation: Correlation): Promise<void> {
  const database = await initDB()
  await database.put('correlations', correlation)
}

export async function getAllCorrelations(): Promise<Correlation[]> {
  const database = await initDB()
  return database.getAll('correlations')
}

// Claude logging operations (for transparency)
export async function logClaudeRequest(request: ClaudeRequest): Promise<void> {
  const database = await initDB()
  await database.put('claudeRequests', request)
}

export async function logClaudeResponse(response: ClaudeResponse): Promise<void> {
  const database = await initDB()
  await database.put('claudeResponses', response)
}

export async function getClaudeHistory(): Promise<{ requests: ClaudeRequest[]; responses: ClaudeResponse[] }> {
  const database = await initDB()
  const requests = await database.getAll('claudeRequests')
  const responses = await database.getAll('claudeResponses')
  return { requests, responses }
}

// Preferences operations
export async function savePreferences(prefs: UserPreferences): Promise<void> {
  const database = await initDB()
  await database.put('preferences', prefs)
}

export async function getPreferences(): Promise<UserPreferences | undefined> {
  const database = await initDB()
  return database.get('preferences', 'user')
}

// Utility to clear all data
export async function clearAllData(): Promise<void> {
  const database = await initDB()
  await database.clear('articles')
  await database.clear('insights')
  await database.clear('correlations')
  await database.clear('claudeRequests')
  await database.clear('claudeResponses')
}
