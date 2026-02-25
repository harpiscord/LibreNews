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
      // Mainstream
      { name: 'The New York Times', url: 'https://nytimes.com', rssUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', orientation: 'center-left', language: 'en', trustworthiness: 85, factCheckRecord: 'good' },
      { name: 'NPR', url: 'https://npr.org', rssUrl: 'https://feeds.npr.org/1004/rss.xml', orientation: 'center-left', language: 'en', trustworthiness: 88, factCheckRecord: 'good' },
      { name: 'AP News', url: 'https://apnews.com', rssUrl: 'https://apnews.com/world.rss', orientation: 'center', language: 'en', trustworthiness: 92, factCheckRecord: 'excellent' },
      // Conservative / Right-leaning
      { name: 'Fox News', url: 'https://foxnews.com', rssUrl: 'https://moxie.foxnews.com/google-publisher/world.xml', orientation: 'right', language: 'en', trustworthiness: 55, factCheckRecord: 'mixed' },
      { name: 'Breitbart', url: 'https://breitbart.com', rssUrl: 'https://feeds.feedburner.com/breitbart', orientation: 'right', language: 'en', trustworthiness: 30, factCheckRecord: 'poor' },
      { name: 'The Daily Wire', url: 'https://dailywire.com', rssUrl: 'https://www.dailywire.com/feeds/rss.xml', orientation: 'right', language: 'en', trustworthiness: 40, factCheckRecord: 'mixed' },
      { name: 'Washington Examiner', url: 'https://washingtonexaminer.com', rssUrl: 'https://www.washingtonexaminer.com/feed', orientation: 'center-right', language: 'en', trustworthiness: 55, factCheckRecord: 'mixed' },
      { name: 'The Epoch Times', url: 'https://theepochtimes.com', rssUrl: 'https://www.theepochtimes.com/feed', orientation: 'right', language: 'en', trustworthiness: 25, factCheckRecord: 'poor' },
      // Progressive / Left-leaning
      { name: 'The Intercept', url: 'https://theintercept.com', rssUrl: 'https://theintercept.com/feed/?rss', orientation: 'left', language: 'en', trustworthiness: 70, factCheckRecord: 'mixed' },
      { name: 'Democracy Now', url: 'https://democracynow.org', rssUrl: 'https://www.democracynow.org/democracynow.rss', orientation: 'left', language: 'en', trustworthiness: 65, factCheckRecord: 'mixed' },
      { name: 'Mother Jones', url: 'https://motherjones.com', rssUrl: 'https://www.motherjones.com/feed/', orientation: 'left', language: 'en', trustworthiness: 68, factCheckRecord: 'mixed' },
      // Conspiracy / Fringe
      { name: 'InfoWars', url: 'https://infowars.com', rssUrl: 'https://www.infowars.com/rss.xml', orientation: 'right', language: 'en', trustworthiness: 10, factCheckRecord: 'unreliable' },
      { name: 'Natural News', url: 'https://naturalnews.com', rssUrl: 'https://www.naturalnews.com/rss.xml', orientation: 'right', language: 'en', trustworthiness: 8, factCheckRecord: 'unreliable' },
      { name: 'ZeroHedge', url: 'https://zerohedge.com', rssUrl: 'https://feeds.feedburner.com/zerohedge/feed', orientation: 'right', language: 'en', trustworthiness: 25, factCheckRecord: 'poor' },
    ],
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    flag: '🇬🇧',
    newspapers: [
      { name: 'The Guardian', url: 'https://theguardian.com', rssUrl: 'https://www.theguardian.com/world/rss', orientation: 'center-left', language: 'en', trustworthiness: 82, factCheckRecord: 'good' },
      { name: 'BBC News', url: 'https://bbc.com/news', rssUrl: 'https://feeds.bbci.co.uk/news/world/rss.xml', orientation: 'center', language: 'en', trustworthiness: 90, factCheckRecord: 'excellent' },
      { name: 'Daily Mail', url: 'https://dailymail.co.uk', rssUrl: 'https://www.dailymail.co.uk/articles.rss', orientation: 'right', language: 'en', trustworthiness: 45, factCheckRecord: 'mixed' },
      { name: 'The Telegraph', url: 'https://telegraph.co.uk', rssUrl: 'https://www.telegraph.co.uk/rss.xml', orientation: 'center-right', language: 'en', trustworthiness: 70, factCheckRecord: 'mixed' },
      { name: 'The Sun', url: 'https://thesun.co.uk', rssUrl: 'https://www.thesun.co.uk/feed/', orientation: 'right', language: 'en', trustworthiness: 35, factCheckRecord: 'poor' },
      { name: 'Morning Star', url: 'https://morningstaronline.co.uk', rssUrl: 'https://morningstaronline.co.uk/feed', orientation: 'left', language: 'en', trustworthiness: 50, factCheckRecord: 'mixed' },
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
      { name: 'RT (Russia Today)', url: 'https://rt.com', rssUrl: 'https://www.rt.com/rss/news/', orientation: 'state', language: 'en', trustworthiness: 20, factCheckRecord: 'unreliable' },
      { name: 'Sputnik News', url: 'https://sputniknews.com', rssUrl: 'https://sputniknews.com/export/rss2/archive/index.xml', orientation: 'state', language: 'en', trustworthiness: 15, factCheckRecord: 'unreliable' },
      { name: 'TASS', url: 'https://tass.com', rssUrl: 'https://tass.com/rss/v2.xml', orientation: 'state', language: 'en', trustworthiness: 30, factCheckRecord: 'poor' },
    ],
  },
  {
    code: 'CN',
    name: 'China',
    flag: '🇨🇳',
    newspapers: [
      { name: 'South China Morning Post', url: 'https://scmp.com', rssUrl: 'https://www.scmp.com/rss/91/feed', orientation: 'center', language: 'en', trustworthiness: 72, factCheckRecord: 'mixed' },
      { name: 'Global Times', url: 'https://globaltimes.cn', rssUrl: 'https://www.globaltimes.cn/rss/outbrain.xml', orientation: 'state', language: 'en', trustworthiness: 25, factCheckRecord: 'poor' },
      { name: 'Xinhua', url: 'https://xinhuanet.com', rssUrl: 'https://www.xinhuanet.com/english/rss/worldrss.xml', orientation: 'state', language: 'en', trustworthiness: 30, factCheckRecord: 'poor' },
      { name: 'CGTN', url: 'https://cgtn.com', rssUrl: 'https://www.cgtn.com/subscribe/rss/section/world.xml', orientation: 'state', language: 'en', trustworthiness: 25, factCheckRecord: 'poor' },
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
      { name: 'Jerusalem Post', url: 'https://jpost.com', rssUrl: 'https://www.jpost.com/rss/rssfeedsfrontpage.aspx', orientation: 'center-right', language: 'en', trustworthiness: 72, factCheckRecord: 'mixed' },
      { name: 'Haaretz', url: 'https://haaretz.com', rssUrl: 'https://www.haaretz.com/cmlink/1.4968994', orientation: 'center-left', language: 'en', trustworthiness: 80, factCheckRecord: 'good' },
      { name: 'Arutz Sheva', url: 'https://israelnationalnews.com', rssUrl: 'https://www.israelnationalnews.com/Rss/Rss.aspx/All', orientation: 'right', language: 'en', trustworthiness: 45, factCheckRecord: 'mixed' },
    ],
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    flag: '🇦🇪',
    newspapers: [
      { name: 'Al Jazeera', url: 'https://aljazeera.com', rssUrl: 'https://www.aljazeera.com/xml/rss/all.xml', orientation: 'center', language: 'en', trustworthiness: 70, factCheckRecord: 'mixed' },
      { name: 'Gulf News', url: 'https://gulfnews.com', rssUrl: 'https://gulfnews.com/rss/uae', orientation: 'center', language: 'en', trustworthiness: 60, factCheckRecord: 'mixed' },
    ],
  },
  {
    code: 'QA',
    name: 'Qatar',
    flag: '🇶🇦',
    newspapers: [
      { name: 'Al Jazeera Arabic', url: 'https://aljazeera.net', rssUrl: 'https://www.aljazeera.net/aljazeerarss/a7c186be-1baa-4bd4-9d80-a84db769f779/73d0e1b4-532f-45ef-b135-bfdff8b8cab9', orientation: 'center', language: 'ar', trustworthiness: 65, factCheckRecord: 'mixed' },
    ],
  },
  {
    code: 'SA',
    name: 'Saudi Arabia',
    flag: '🇸🇦',
    newspapers: [
      { name: 'Arab News', url: 'https://arabnews.com', rssUrl: 'https://www.arabnews.com/rss.xml', orientation: 'state', language: 'en', trustworthiness: 50, factCheckRecord: 'mixed' },
      { name: 'Al Arabiya', url: 'https://english.alarabiya.net', rssUrl: 'https://english.alarabiya.net/tools/rss', orientation: 'state', language: 'en', trustworthiness: 55, factCheckRecord: 'mixed' },
    ],
  },
  {
    code: 'IR',
    name: 'Iran',
    flag: '🇮🇷',
    newspapers: [
      { name: 'Press TV', url: 'https://presstv.ir', rssUrl: 'https://www.presstv.ir/rss.aspx', orientation: 'state', language: 'en', trustworthiness: 20, factCheckRecord: 'unreliable' },
      { name: 'Tehran Times', url: 'https://tehrantimes.com', rssUrl: 'https://www.tehrantimes.com/rss', orientation: 'state', language: 'en', trustworthiness: 25, factCheckRecord: 'poor' },
      { name: 'Fars News', url: 'https://farsnews.ir', rssUrl: 'https://www.farsnews.ir/rss', orientation: 'state', language: 'en', trustworthiness: 20, factCheckRecord: 'unreliable' },
    ],
  },
  {
    code: 'TR',
    name: 'Turkey',
    flag: '🇹🇷',
    newspapers: [
      { name: 'Daily Sabah', url: 'https://dailysabah.com', rssUrl: 'https://www.dailysabah.com/rss/world', orientation: 'state', language: 'en', trustworthiness: 40, factCheckRecord: 'poor' },
      { name: 'TRT World', url: 'https://trtworld.com', rssUrl: 'https://www.trtworld.com/rss/news.xml', orientation: 'state', language: 'en', trustworthiness: 45, factCheckRecord: 'mixed' },
      { name: 'Ahval News', url: 'https://ahvalnews.com', rssUrl: 'https://ahvalnews.com/rss.xml', orientation: 'center', language: 'en', trustworthiness: 70, factCheckRecord: 'mixed' },
    ],
  },
  {
    code: 'PS',
    name: 'Palestine',
    flag: '🇵🇸',
    newspapers: [
      { name: 'Middle East Eye', url: 'https://middleeasteye.net', rssUrl: 'https://www.middleeasteye.net/rss', orientation: 'center-left', language: 'en', trustworthiness: 60, factCheckRecord: 'mixed' },
      { name: 'Electronic Intifada', url: 'https://electronicintifada.net', rssUrl: 'https://electronicintifada.net/rss.xml', orientation: 'left', language: 'en', trustworthiness: 50, factCheckRecord: 'mixed' },
      { name: 'Palestine Chronicle', url: 'https://palestinechronicle.com', rssUrl: 'https://www.palestinechronicle.com/feed/', orientation: 'left', language: 'en', trustworthiness: 45, factCheckRecord: 'mixed' },
    ],
  },
  {
    code: 'SY',
    name: 'Syria',
    flag: '🇸🇾',
    newspapers: [
      { name: 'SANA', url: 'https://sana.sy', rssUrl: 'https://sana.sy/en/?feed=rss2', orientation: 'state', language: 'en', trustworthiness: 15, factCheckRecord: 'unreliable' },
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
