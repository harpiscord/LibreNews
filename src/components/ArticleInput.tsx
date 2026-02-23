import { useState } from 'react'
import { Newspaper } from '../lib/countries'

interface ArticleInputProps {
  selectedNewspaper: Newspaper | null
  selectedCountry: string | null
  onSubmit: (article: {
    title: string
    content: string
    source: string
    country: string
    originalLanguage: string
    url: string
    publishedAt: string
  }) => void
  onCancel: () => void
}

export function ArticleInput({ selectedNewspaper, selectedCountry, onSubmit, onCancel }: ArticleInputProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [url, setUrl] = useState(selectedNewspaper?.url || '')
  const [publishedAt, setPublishedAt] = useState(new Date().toISOString().split('T')[0])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedNewspaper || !selectedCountry) return

    onSubmit({
      title,
      content,
      source: selectedNewspaper.name,
      country: selectedCountry,
      originalLanguage: selectedNewspaper.language,
      url,
      publishedAt,
    })

    setTitle('')
    setContent('')
    setUrl('')
  }

  if (!selectedNewspaper) {
    return (
      <div className="article-input">
        <p className="empty-state">Select a newspaper to add an article</p>
      </div>
    )
  }

  return (
    <div className="article-input">
      <h3>Add Article from {selectedNewspaper.name}</h3>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="title">Article Title</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Enter article title"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="url">Article URL</label>
          <input
            type="url"
            id="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>

        <div className="form-group">
          <label htmlFor="publishedAt">Published Date</label>
          <input
            type="date"
            id="publishedAt"
            value={publishedAt}
            onChange={e => setPublishedAt(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="content">Article Content</label>
          <textarea
            id="content"
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Paste the article content here..."
            rows={10}
            required
          />
        </div>

        <div className="form-actions">
          <button type="submit">Add Article</button>
          <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  )
}
