import { app, BrowserWindow, ipcMain } from 'electron'
import * as path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import Parser from 'rss-parser'

let mainWindow: BrowserWindow | null = null
let anthropicClient: Anthropic | null = null
const rssParser = new Parser({
  customFields: {
    item: ['media:content', 'media:thumbnail', 'content:encoded'],
  },
})

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// IPC Handlers for Anthropic API
ipcMain.handle('anthropic:initialize', async (_event, apiKey: string) => {
  try {
    anthropicClient = new Anthropic({ apiKey })
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('anthropic:test-key', async (_event, apiKey: string) => {
  try {
    const testClient = new Anthropic({ apiKey })
    await testClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }],
    })
    return { valid: true }
  } catch (error) {
    return { valid: false, error: String(error) }
  }
})

ipcMain.handle('anthropic:message', async (_event, params: {
  model: string
  max_tokens: number
  messages: Array<{ role: string; content: string }>
  system?: string
}) => {
  if (!anthropicClient) {
    throw new Error('Anthropic client not initialized')
  }

  try {
    const response = await anthropicClient.messages.create({
      model: params.model,
      max_tokens: params.max_tokens,
      messages: params.messages as Anthropic.MessageParam[],
      system: params.system,
    })
    return response
  } catch (error) {
    throw error
  }
})

ipcMain.handle('anthropic:is-initialized', () => {
  return anthropicClient !== null
})

// Topic classification keywords (fast local classification without AI)
const topicKeywords: Record<string, string[]> = {
  politics: ['election', 'president', 'minister', 'parliament', 'senate', 'congress', 'vote', 'political', 'government', 'legislation', 'bill', 'law', 'democracy', 'republican', 'democrat', 'party', 'campaign'],
  international: ['diplomatic', 'embassy', 'foreign', 'treaty', 'summit', 'nato', 'united nations', 'bilateral', 'sanctions', 'alliance', 'border', 'refugee', 'migration'],
  cybersecurity: ['cyber', 'hack', 'breach', 'ransomware', 'malware', 'phishing', 'data leak', 'vulnerability', 'encryption', 'security', 'attack', 'hacker', 'threat actor'],
  economy: ['economy', 'economic', 'gdp', 'inflation', 'interest rate', 'stock', 'market', 'trade', 'tariff', 'finance', 'bank', 'currency', 'recession', 'growth'],
  military: ['military', 'army', 'navy', 'defense', 'weapon', 'missile', 'nuclear', 'war', 'troops', 'soldier', 'combat', 'airstrike', 'drone'],
  energy: ['oil', 'gas', 'energy', 'renewable', 'solar', 'wind', 'nuclear power', 'pipeline', 'opec', 'petroleum', 'electricity', 'grid'],
  technology: ['ai', 'artificial intelligence', 'tech', 'software', 'hardware', 'startup', 'silicon valley', 'chip', 'semiconductor', 'innovation', 'digital'],
  health: ['health', 'pandemic', 'virus', 'vaccine', 'hospital', 'disease', 'outbreak', 'medical', 'who', 'covid', 'epidemic'],
  environment: ['climate', 'environment', 'carbon', 'emission', 'warming', 'pollution', 'sustainable', 'green', 'forest', 'biodiversity'],
}

function classifyTopic(title: string, content: string): { topic: string; confidence: number } {
  const text = `${title} ${content}`.toLowerCase()
  const scores: Record<string, number> = {}

  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    scores[topic] = 0
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        scores[topic] += keyword.length > 5 ? 2 : 1 // Longer keywords get more weight
      }
    }
  }

  const maxScore = Math.max(...Object.values(scores))
  if (maxScore === 0) return { topic: 'other', confidence: 0.5 }

  const topTopic = Object.entries(scores).find(([_, s]) => s === maxScore)?.[0] || 'other'
  const confidence = Math.min(maxScore / 10, 1) // Cap at 1.0

  return { topic: topTopic, confidence }
}

// Simple similarity check for clustering
function calculateSimilarity(title1: string, title2: string): number {
  const words1 = new Set(title1.toLowerCase().split(/\s+/).filter(w => w.length > 3))
  const words2 = new Set(title2.toLowerCase().split(/\s+/).filter(w => w.length > 3))
  const intersection = [...words1].filter(w => words2.has(w)).length
  const union = new Set([...words1, ...words2]).size
  return union > 0 ? intersection / union : 0
}

// RSS Feed Fetching
ipcMain.handle('rss:fetch', async (_event, feeds: Array<{
  rssUrl: string
  sourceName: string
  country: string
  orientation: string
  language: string
  trustworthiness: number
  factCheckRecord: string
}>) => {
  const results: Array<{
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
  }> = []

  for (const feed of feeds) {
    try {
      const parsed = await rssParser.parseURL(feed.rssUrl)
      const items = parsed.items.slice(0, 5) // Limit to 5 articles per source

      for (const item of items) {
        const content = item['content:encoded'] || item.contentSnippet || item.content || item.summary || ''
        const title = item.title || 'Untitled'
        const { topic, confidence } = classifyTopic(title, content)

        results.push({
          title,
          content,
          url: item.link || '',
          source: feed.sourceName,
          country: feed.country,
          orientation: feed.orientation,
          originalLanguage: feed.language,
          publishedAt: item.pubDate || item.isoDate || new Date().toISOString(),
          trustworthiness: feed.trustworthiness,
          factCheckRecord: feed.factCheckRecord,
          topic,
          topicConfidence: confidence,
          clusterId: '', // Will be assigned below
          trendingScore: 0, // Will be calculated below
          isTrending: false,
        })
      }
    } catch (error) {
      console.error(`Failed to fetch RSS from ${feed.sourceName}:`, error)
    }
  }

  // Cluster similar articles
  const clusters: string[][] = []
  const assigned = new Set<number>()

  for (let i = 0; i < results.length; i++) {
    if (assigned.has(i)) continue

    const cluster = [i]
    assigned.add(i)

    for (let j = i + 1; j < results.length; j++) {
      if (assigned.has(j)) continue

      const similarity = calculateSimilarity(results[i].title, results[j].title)
      if (similarity > 0.3) { // 30% similarity threshold
        cluster.push(j)
        assigned.add(j)
      }
    }

    clusters.push(cluster.map(idx => String(idx)))
  }

  // Assign cluster IDs and calculate trending scores
  clusters.forEach((cluster, clusterIdx) => {
    const clusterId = cluster.length > 1 ? `cluster-${clusterIdx}` : ''

    // Calculate trending score based on:
    // 1. Number of sources covering the story
    // 2. Number of different countries covering it
    // 3. Diversity of political orientations covering it
    const clusterIndices = cluster.map(s => parseInt(s))
    const uniqueCountries = new Set(clusterIndices.map(i => results[i].country))
    const uniqueOrientations = new Set(clusterIndices.map(i => results[i].orientation))

    // Trending score formula:
    // - Base: number of sources (max 10 points)
    // - Country diversity bonus: unique countries * 3 (max 15 points for 5+ countries)
    // - Orientation diversity bonus: unique orientations * 2 (max 10 points)
    const sourceScore = Math.min(clusterIndices.length * 2, 10)
    const countryScore = Math.min(uniqueCountries.size * 3, 15)
    const orientationScore = Math.min(uniqueOrientations.size * 2, 10)
    const trendingScore = sourceScore + countryScore + orientationScore

    // A story is "trending" if it has:
    // - At least 2 sources AND
    // - At least 2 different countries OR trending score >= 15
    const isTrending = clusterIndices.length >= 2 && (uniqueCountries.size >= 2 || trendingScore >= 15)

    cluster.forEach(idxStr => {
      const idx = parseInt(idxStr)
      results[idx].clusterId = clusterId
      results[idx].trendingScore = trendingScore
      results[idx].isTrending = isTrending
    })
  })

  return results
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
