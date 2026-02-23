// Database of countries and their newspapers with political orientation

export interface Newspaper {
  name: string
  url: string
  rssUrl: string
  orientation: 'left' | 'center-left' | 'center' | 'center-right' | 'right' | 'state'
  language: string
  trustworthiness: number // 0-100 scale based on fact-checking records, editorial standards
  factCheckRecord: 'excellent' | 'good' | 'mixed' | 'poor' | 'unreliable'
}

export interface Country {
  code: string
  name: string
  flag: string
  newspapers: Newspaper[]
}

export const countries: Country[] = [
  {
    code: 'US',
    name: 'United States',
    flag: '🇺🇸',
    newspapers: [
      { name: 'The New York Times', url: 'https://nytimes.com', rssUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', orientation: 'center-left', language: 'en', trustworthiness: 85, factCheckRecord: 'good' },
      { name: 'NPR', url: 'https://npr.org', rssUrl: 'https://feeds.npr.org/1004/rss.xml', orientation: 'center-left', language: 'en', trustworthiness: 88, factCheckRecord: 'good' },
      { name: 'AP News', url: 'https://apnews.com', rssUrl: 'https://apnews.com/world.rss', orientation: 'center', language: 'en', trustworthiness: 92, factCheckRecord: 'excellent' },
    ],
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    flag: '🇬🇧',
    newspapers: [
      { name: 'The Guardian', url: 'https://theguardian.com', rssUrl: 'https://www.theguardian.com/world/rss', orientation: 'center-left', language: 'en', trustworthiness: 82, factCheckRecord: 'good' },
      { name: 'BBC News', url: 'https://bbc.com/news', rssUrl: 'https://feeds.bbci.co.uk/news/world/rss.xml', orientation: 'center', language: 'en', trustworthiness: 90, factCheckRecord: 'excellent' },
    ],
  },
  {
    code: 'DE',
    name: 'Germany',
    flag: '🇩🇪',
    newspapers: [
      { name: 'Der Spiegel', url: 'https://spiegel.de', rssUrl: 'https://www.spiegel.de/international/index.rss', orientation: 'center-left', language: 'de', trustworthiness: 85, factCheckRecord: 'good' },
      { name: 'Deutsche Welle', url: 'https://dw.com', rssUrl: 'https://rss.dw.com/rdf/rss-en-world', orientation: 'center', language: 'en', trustworthiness: 88, factCheckRecord: 'excellent' },
    ],
  },
  {
    code: 'FR',
    name: 'France',
    flag: '🇫🇷',
    newspapers: [
      { name: 'France 24', url: 'https://france24.com', rssUrl: 'https://www.france24.com/en/rss', orientation: 'center', language: 'en', trustworthiness: 82, factCheckRecord: 'good' },
    ],
  },
  {
    code: 'RU',
    name: 'Russia',
    flag: '🇷🇺',
    newspapers: [
      { name: 'Moscow Times', url: 'https://themoscowtimes.com', rssUrl: 'https://www.themoscowtimes.com/rss/news', orientation: 'center', language: 'en', trustworthiness: 75, factCheckRecord: 'good' },
    ],
  },
  {
    code: 'CN',
    name: 'China',
    flag: '🇨🇳',
    newspapers: [
      { name: 'South China Morning Post', url: 'https://scmp.com', rssUrl: 'https://www.scmp.com/rss/91/feed', orientation: 'center', language: 'en', trustworthiness: 72, factCheckRecord: 'mixed' },
    ],
  },
  {
    code: 'JP',
    name: 'Japan',
    flag: '🇯🇵',
    newspapers: [
      { name: 'The Japan Times', url: 'https://japantimes.co.jp', rssUrl: 'https://www.japantimes.co.jp/feed/', orientation: 'center', language: 'en', trustworthiness: 82, factCheckRecord: 'good' },
      { name: 'NHK World', url: 'https://www3.nhk.or.jp/nhkworld', rssUrl: 'https://www3.nhk.or.jp/rss/news/cat0.xml', orientation: 'center', language: 'en', trustworthiness: 88, factCheckRecord: 'excellent' },
    ],
  },
  {
    code: 'IN',
    name: 'India',
    flag: '🇮🇳',
    newspapers: [
      { name: 'The Hindu', url: 'https://thehindu.com', rssUrl: 'https://www.thehindu.com/news/international/feeder/default.rss', orientation: 'center-left', language: 'en', trustworthiness: 78, factCheckRecord: 'good' },
    ],
  },
  {
    code: 'AU',
    name: 'Australia',
    flag: '🇦🇺',
    newspapers: [
      { name: 'ABC News Australia', url: 'https://abc.net.au/news', rssUrl: 'https://www.abc.net.au/news/feed/51120/rss.xml', orientation: 'center', language: 'en', trustworthiness: 88, factCheckRecord: 'excellent' },
    ],
  },
  {
    code: 'CA',
    name: 'Canada',
    flag: '🇨🇦',
    newspapers: [
      { name: 'CBC News', url: 'https://cbc.ca/news', rssUrl: 'https://www.cbc.ca/cmlink/rss-world', orientation: 'center', language: 'en', trustworthiness: 85, factCheckRecord: 'excellent' },
    ],
  },
  {
    code: 'IL',
    name: 'Israel',
    flag: '🇮🇱',
    newspapers: [
      { name: 'Times of Israel', url: 'https://timesofisrael.com', rssUrl: 'https://www.timesofisrael.com/feed/', orientation: 'center', language: 'en', trustworthiness: 78, factCheckRecord: 'good' },
    ],
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    flag: '🇦🇪',
    newspapers: [
      { name: 'Al Jazeera', url: 'https://aljazeera.com', rssUrl: 'https://www.aljazeera.com/xml/rss/all.xml', orientation: 'center', language: 'en', trustworthiness: 70, factCheckRecord: 'mixed' },
    ],
  },
  {
    code: 'ZA',
    name: 'South Africa',
    flag: '🇿🇦',
    newspapers: [
      { name: 'Daily Maverick', url: 'https://dailymaverick.co.za', rssUrl: 'https://www.dailymaverick.co.za/dmrss/', orientation: 'center-left', language: 'en', trustworthiness: 82, factCheckRecord: 'good' },
    ],
  },
  {
    code: 'KR',
    name: 'South Korea',
    flag: '🇰🇷',
    newspapers: [
      { name: 'Yonhap News', url: 'https://en.yna.co.kr', rssUrl: 'https://en.yna.co.kr/RSS/news.xml', orientation: 'center', language: 'en', trustworthiness: 82, factCheckRecord: 'good' },
    ],
  },
  {
    code: 'UA',
    name: 'Ukraine',
    flag: '🇺🇦',
    newspapers: [
      { name: 'Kyiv Independent', url: 'https://kyivindependent.com', rssUrl: 'https://kyivindependent.com/feed/', orientation: 'center', language: 'en', trustworthiness: 78, factCheckRecord: 'good' },
    ],
  },
]

export function getCountryByCode(code: string): Country | undefined {
  return countries.find(c => c.code === code)
}

export function getAllCountries(): Country[] {
  return countries
}

export const languageNames: Record<string, string> = {
  en: 'English',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  ar: 'Arabic',
  he: 'Hebrew',
  tr: 'Turkish',
}

export const orientationLabels: Record<string, { short: string; full: string; color: string }> = {
  'left': { short: 'L', full: 'Left-leaning', color: '#0066cc' },
  'center-left': { short: 'CL', full: 'Center-Left', color: '#0088aa' },
  'center': { short: 'C', full: 'Center/Neutral', color: '#666666' },
  'center-right': { short: 'CR', full: 'Center-Right', color: '#aa4400' },
  'right': { short: 'R', full: 'Right-leaning', color: '#cc0000' },
  'state': { short: 'S', full: 'State-controlled', color: '#880088' },
}

// Intelligence-relevant topics (excluding sports, entertainment)
export const topics = [
  { id: 'politics', label: 'Politics', icon: '🏛️' },
  { id: 'international', label: 'International Affairs', icon: '🌍' },
  { id: 'cybersecurity', label: 'Cybersecurity', icon: '🔒' },
  { id: 'economy', label: 'Economy & Finance', icon: '📊' },
  { id: 'military', label: 'Military & Defense', icon: '🎖️' },
  { id: 'energy', label: 'Energy & Resources', icon: '⚡' },
  { id: 'technology', label: 'Technology', icon: '💻' },
  { id: 'health', label: 'Health & Pandemics', icon: '🏥' },
  { id: 'environment', label: 'Environment & Climate', icon: '🌡️' },
] as const

export type TopicId = typeof topics[number]['id']

// Get source trustworthiness info
export function getSourceTrust(sourceName: string): { trustworthiness: number; factCheckRecord: string } | null {
  for (const country of countries) {
    const paper = country.newspapers.find(n => n.name === sourceName)
    if (paper) {
      return { trustworthiness: paper.trustworthiness, factCheckRecord: paper.factCheckRecord }
    }
  }
  return null
}

// Trust level labels
export const trustLevelLabels: Record<string, { label: string; color: string }> = {
  'excellent': { label: 'Highly Reliable', color: '#2e7d32' },
  'good': { label: 'Generally Reliable', color: '#558b2f' },
  'mixed': { label: 'Mixed Record', color: '#f57c00' },
  'poor': { label: 'Caution Advised', color: '#e65100' },
  'unreliable': { label: 'Unreliable', color: '#c62828' },
}
