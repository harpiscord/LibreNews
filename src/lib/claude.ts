// Claude API integration via Electron IPC
import { logClaudeRequest, logClaudeResponse } from './db'

// Claude Sonnet pricing (as of 2024)
// Input: $3 per million tokens, Output: $15 per million tokens
const CLAUDE_SONNET_INPUT_COST_PER_TOKEN = 3 / 1_000_000
const CLAUDE_SONNET_OUTPUT_COST_PER_TOKEN = 15 / 1_000_000

function calculateCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens * CLAUDE_SONNET_INPUT_COST_PER_TOKEN) +
         (outputTokens * CLAUDE_SONNET_OUTPUT_COST_PER_TOKEN)
}

declare global {
  interface Window {
    electronAPI: {
      anthropic: {
        initialize: (apiKey: string) => Promise<{ success: boolean; error?: string }>
        testKey: (apiKey: string) => Promise<{ valid: boolean; error?: string }>
        message: (params: {
          model: string
          max_tokens: number
          messages: Array<{ role: string; content: string }>
          system?: string
        }) => Promise<{
          content: Array<{ type: string; text?: string }>
          usage: { input_tokens: number; output_tokens: number }
        }>
        isInitialized: () => Promise<boolean>
      }
      platform: string
    }
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

async function sendMessage(prompt: string, system?: string, maxTokens: number = 4096, operation: string = 'unknown'): Promise<string> {
  const requestId = generateId()
  const timestamp = new Date().toISOString()

  await logClaudeRequest({
    id: requestId,
    timestamp,
    prompt,
    model: 'claude-sonnet-4-20250514',
    maxTokens,
  })

  const response = await window.electronAPI.anthropic.message({
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
    system,
  })

  const textContent = response.content.find(c => c.type === 'text')
  const text = textContent?.text || ''

  const inputTokens = response.usage.input_tokens
  const outputTokens = response.usage.output_tokens
  const costUSD = calculateCost(inputTokens, outputTokens)

  await logClaudeResponse({
    id: generateId(),
    requestId,
    timestamp: new Date().toISOString(),
    content: text,
    inputTokens,
    outputTokens,
    costUSD,
    operation,
  })

  return text
}

export async function translateContent(
  content: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<string> {
  const prompt = `Translate the following news article from ${sourceLanguage} to ${targetLanguage}.
Preserve the original meaning, tone, and nuance. Only return the translated text, nothing else.

Article:
${content}`

  return sendMessage(prompt, undefined, 4096, 'translate')
}

export async function analyzeBias(content: string, source: string): Promise<{
  score: number
  confidence: number
  explanation: string
  indicators: string[]
}> {
  const systemPrompt = `You are a media bias analyst. Always respond with valid JSON only, no markdown formatting.`

  const prompt = `Analyze the political bias in the following news article from ${source}.

Article:
${content.substring(0, 3000)}

Respond with this exact JSON structure:
{
  "score": <number from -1.0 (far left) to 1.0 (far right), 0 being neutral>,
  "confidence": <number from 0.0 to 1.0>,
  "explanation": "Brief explanation of the bias assessment",
  "indicators": ["indicator 1", "indicator 2"]
}

Respond with ONLY the JSON object.`

  const response = await sendMessage(prompt, systemPrompt, 4096, 'analyze_bias')
  try {
    let jsonStr = response.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    }
    const parsed = JSON.parse(jsonStr)
    return {
      score: typeof parsed.score === 'number' ? parsed.score : 0,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      explanation: parsed.explanation || 'No explanation provided',
      indicators: Array.isArray(parsed.indicators) ? parsed.indicators : []
    }
  } catch {
    return { score: 0, confidence: 0.5, explanation: 'Analysis could not be completed', indicators: [] }
  }
}

export async function assessTrustScore(content: string, source: string): Promise<{
  score: number
  factors: string[]
  explanation: string
}> {
  const prompt = `Assess trustworthiness of this article from ${source}.

Return JSON:
{
  "score": <0-100>,
  "factors": ["<factors>"],
  "explanation": "<explanation>"
}

Article:
${content}

Return ONLY valid JSON.`

  const response = await sendMessage(prompt, undefined, 4096, 'assess_trust')
  try {
    let jsonStr = response.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    }
    return JSON.parse(jsonStr)
  } catch {
    return { score: 50, factors: [], explanation: 'Unable to parse' }
  }
}

export async function detectFakeNews(content: string): Promise<{
  isFake: boolean
  confidence: number
  redFlags: string[]
  explanation: string
}> {
  const prompt = `Analyze for misinformation/fake news:

Return JSON:
{
  "isFake": <boolean>,
  "confidence": <0-1>,
  "redFlags": ["<concerns>"],
  "explanation": "<explanation>"
}

Article:
${content}

Return ONLY valid JSON.`

  const response = await sendMessage(prompt, undefined, 4096, 'detect_fake_news')
  try {
    let jsonStr = response.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    }
    return JSON.parse(jsonStr)
  } catch {
    return { isFake: false, confidence: 0.5, redFlags: [], explanation: 'Unable to parse' }
  }
}

export async function correlateArticles(
  articles: Array<{ title: string; content: string; source: string; country: string; orientation: string }>
): Promise<{
  topic: string
  analysis: string
  perspectivesByCountry: Record<string, string>
  perspectivesByOrientation: Record<string, string>
  commonGround: string[]
  divergences: string[]
}> {
  const countriesList = articles.map(a => a.country).join(', ')
  const orientations = [...new Set(articles.map(a => a.orientation))]
  const articlesText = articles.map((a, i) =>
    `Article ${i + 1} (${a.source}, ${a.country}, Political Orientation: ${a.orientation}):\nTitle: ${a.title}\nContent: ${a.content.substring(0, 1500)}`
  ).join('\n\n---\n\n')

  const systemPrompt = `You are a cross-regional news analyst. You analyze how different countries and political orientations cover the same news story. Always respond with valid JSON only, no markdown formatting, no code blocks, just raw JSON.`

  const prompt = `Analyze these ${articles.length} news articles from different countries (${countriesList}) and political orientations (${orientations.join(', ')}) covering the same topic.

${articlesText}

Provide a comprehensive cross-regional and political analysis in the following JSON format:

{
  "topic": "A clear, concise description of the main topic being covered",
  "analysis": "A detailed 2-3 paragraph analysis of how the coverage differs across regions and political orientations, noting tone, emphasis, and framing differences",
  "perspectivesByCountry": {
    "${articles[0]?.country || 'Country1'}": "How this country's media frames and presents this story",
    "${articles[1]?.country || 'Country2'}": "How this country's media frames and presents this story"
  },
  "perspectivesByOrientation": {
    "left": "How left-leaning sources cover this story (focus, framing, emphasis)",
    "center": "How centrist sources cover this story",
    "right": "How right-leaning sources cover this story",
    "state": "How state-controlled media covers this story (if applicable)"
  },
  "commonGround": [
    "Fact or perspective that all sources agree on",
    "Another shared element across all coverage"
  ],
  "divergences": [
    "Key difference in how sources cover this story",
    "Another significant divergence in framing or emphasis"
  ]
}

Important:
- Include a perspective entry for each country represented in the articles (${countriesList}).
- Include perspective entries for each political orientation present: ${orientations.join(', ')}.
- Highlight how political bias affects the framing of this news story.
Respond with ONLY the JSON object, no additional text or formatting.`

  const response = await sendMessage(prompt, systemPrompt, 8192, 'cross_regional_analysis')

  try {
    // Try to extract JSON if it's wrapped in markdown code blocks
    let jsonStr = response.trim()

    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7)
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3)
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3)
    }
    jsonStr = jsonStr.trim()

    const parsed = JSON.parse(jsonStr)

    // Validate the structure
    return {
      topic: parsed.topic || 'Cross-Regional News Analysis',
      analysis: parsed.analysis || 'Analysis not available',
      perspectivesByCountry: parsed.perspectivesByCountry || {},
      perspectivesByOrientation: parsed.perspectivesByOrientation || {},
      commonGround: Array.isArray(parsed.commonGround) ? parsed.commonGround : [],
      divergences: Array.isArray(parsed.divergences) ? parsed.divergences : []
    }
  } catch (err) {
    console.error('Failed to parse correlation response:', err, 'Response:', response)

    // Return a meaningful fallback with the raw response
    return {
      topic: 'Cross-Regional Analysis',
      analysis: response || 'Analysis could not be generated. Please try again.',
      perspectivesByCountry: {},
      perspectivesByOrientation: {},
      commonGround: [],
      divergences: []
    }
  }
}

export async function generateClusterName(articles: Array<{ title: string; content: string }>): Promise<string> {
  const prompt = `Based on these news article titles, generate a short (3-6 words) topic name that describes what they're about:

${articles.map((a, i) => `${i + 1}. ${a.title}`).join('\n')}

Return ONLY the topic name, nothing else.`

  return sendMessage(prompt, undefined, 64, 'generate_cluster_name')
}

export async function summarizeArticle(content: string): Promise<string> {
  const prompt = `Summarize this news article in 2-3 concise paragraphs:

${content}`

  return sendMessage(prompt, undefined, 4096, 'summarize')
}

export async function analyzeImage(
  imageUrl: string,
  articleTitle: string,
  articleContent: string
): Promise<{
  isManipulated: boolean
  manipulationScore: number
  misleadingScore: number
  findings: string[]
  explanation: string
}> {
  const systemPrompt = `You are a media forensics expert specializing in detecting manipulated or misleading images in news articles. Always respond with valid JSON only, no markdown formatting.`

  const prompt = `Analyze this news article image for potential manipulation or misleading usage.

Image URL: ${imageUrl}
Article Title: ${articleTitle}
Article Context: ${articleContent.substring(0, 1000)}

Evaluate:
1. Signs of image manipulation (editing, compositing, AI generation)
2. Whether the image is misleading in context (e.g., old photo used for new event, unrelated image, out-of-context)
3. Visual propaganda techniques or emotional manipulation

Return JSON:
{
  "isManipulated": <boolean - true if image shows signs of manipulation>,
  "manipulationScore": <0-100 - likelihood the image has been edited/manipulated>,
  "misleadingScore": <0-100 - how misleading is this image in the article's context>,
  "findings": ["specific finding 1", "specific finding 2"],
  "explanation": "Detailed explanation of the analysis"
}

Note: Without being able to directly analyze the image, base your assessment on:
- The image URL patterns (stock photo sites, known manipulation indicators)
- Context clues from the article
- Common manipulation patterns in news media

Return ONLY valid JSON.`

  const response = await sendMessage(prompt, systemPrompt, 4096, 'analyze_image')
  try {
    let jsonStr = response.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    }
    const parsed = JSON.parse(jsonStr)
    return {
      isManipulated: Boolean(parsed.isManipulated),
      manipulationScore: typeof parsed.manipulationScore === 'number' ? parsed.manipulationScore : 0,
      misleadingScore: typeof parsed.misleadingScore === 'number' ? parsed.misleadingScore : 0,
      findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      explanation: parsed.explanation || 'Analysis could not be completed'
    }
  } catch {
    return {
      isManipulated: false,
      manipulationScore: 0,
      misleadingScore: 0,
      findings: [],
      explanation: 'Unable to analyze image'
    }
  }
}

export async function translateTitle(
  title: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<string> {
  const prompt = `Translate this news headline from ${sourceLanguage} to ${targetLanguage}.
Preserve the tone and impact. Return ONLY the translated headline, nothing else.

Headline: ${title}`

  return sendMessage(prompt, undefined, 256, 'translate_title')
}
