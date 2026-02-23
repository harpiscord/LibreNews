import { Article } from '../lib/db'

interface ArticleCardProps {
  article: Article
  onSave: () => void
  onDelete: () => void
  onAnalyzeBias: () => void
  onTranslate: () => void
  onCheckFakeNews: () => void
}

export function ArticleCard({
  article,
  onSave,
  onDelete,
  onAnalyzeBias,
  onTranslate,
  onCheckFakeNews,
}: ArticleCardProps) {
  const getBiasLabel = (score: number) => {
    if (score < -0.6) return 'Far Left'
    if (score < -0.3) return 'Left'
    if (score < 0.3) return 'Center'
    if (score < 0.6) return 'Right'
    return 'Far Right'
  }

  const getBiasColor = (score: number) => {
    if (score < -0.3) return '#e74c3c'
    if (score < 0.3) return '#95a5a6'
    return '#3498db'
  }

  return (
    <div className="article-card">
      <div className="article-header">
        <h3>{article.title}</h3>
        <div className="article-meta">
          <span className="source">{article.source}</span>
          <span className="country">{article.country}</span>
          <span className="date">{new Date(article.publishedAt).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="article-content">
        <p>{article.translatedContent || article.content}</p>
      </div>

      {article.biasAnalysis && (
        <div className="bias-indicator" style={{ borderColor: getBiasColor(article.biasAnalysis.score) }}>
          <span className="bias-label">{getBiasLabel(article.biasAnalysis.score)}</span>
          <span className="bias-explanation">{article.biasAnalysis.explanation}</span>
        </div>
      )}

      {article.trustScore !== undefined && (
        <div className="trust-score">
          <span>Trust Score: {article.trustScore}/100</span>
        </div>
      )}

      <div className="article-actions">
        <button onClick={onSave}>{article.saved ? 'Unsave' : 'Save'}</button>
        <button onClick={onTranslate}>Translate</button>
        <button onClick={onAnalyzeBias}>Analyze Bias</button>
        <button onClick={onCheckFakeNews}>Check Fake News</button>
        <button onClick={onDelete} className="danger">Delete</button>
      </div>
    </div>
  )
}
