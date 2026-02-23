import { useState } from 'react'
import { Article } from '../lib/db'
import { correlateArticles } from '../lib/claude'

interface CorrelationPanelProps {
  articles: Article[]
}

export function CorrelationPanel({ articles }: CorrelationPanelProps) {
  const [selectedArticles, setSelectedArticles] = useState<string[]>([])
  const [analysis, setAnalysis] = useState<{
    topic: string
    analysis: string
    perspectivesByCountry: Record<string, string>
    commonGround: string[]
    divergences: string[]
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const toggleArticle = (id: string) => {
    setSelectedArticles(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    )
  }

  const runCorrelation = async () => {
    if (selectedArticles.length < 2) {
      alert('Select at least 2 articles to correlate')
      return
    }

    setIsLoading(true)
    try {
      const articlesToAnalyze = articles
        .filter(a => selectedArticles.includes(a.id))
        .map(a => ({
          title: a.title,
          content: a.translatedContent || a.content,
          source: a.source,
          country: a.country,
        }))

      const result = await correlateArticles(articlesToAnalyze)
      setAnalysis(result)
    } catch (err) {
      console.error(err)
    }
    setIsLoading(false)
  }

  return (
    <div className="correlation-panel">
      <h3>Cross-Regional Analysis</h3>
      <p className="description">Select articles from different countries to analyze how they cover the same topic.</p>

      <div className="article-selector">
        {articles.map(article => (
          <label key={article.id} className="article-checkbox">
            <input
              type="checkbox"
              checked={selectedArticles.includes(article.id)}
              onChange={() => toggleArticle(article.id)}
            />
            <span className="article-info">
              <strong>{article.title}</strong>
              <span className="meta">{article.source} ({article.country})</span>
            </span>
          </label>
        ))}
      </div>

      <button onClick={runCorrelation} disabled={isLoading || selectedArticles.length < 2}>
        {isLoading ? 'Analyzing...' : `Analyze ${selectedArticles.length} Articles`}
      </button>

      {analysis && (
        <div className="analysis-results">
          <h4>Topic: {analysis.topic}</h4>

          <div className="section">
            <h5>Analysis</h5>
            <p>{analysis.analysis}</p>
          </div>

          <div className="section">
            <h5>Perspectives by Country</h5>
            {Object.entries(analysis.perspectivesByCountry).map(([country, perspective]) => (
              <div key={country} className="perspective">
                <strong>{country}:</strong> {perspective}
              </div>
            ))}
          </div>

          <div className="section">
            <h5>Common Ground</h5>
            <ul>
              {analysis.commonGround.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="section">
            <h5>Divergences</h5>
            <ul>
              {analysis.divergences.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
