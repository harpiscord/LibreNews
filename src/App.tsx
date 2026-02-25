import { useState, useEffect, useMemo } from 'react'
import './App.css'
import { useAuth } from './hooks/useAuth'
import { usePreferences } from './hooks/usePreferences'
import { useArticles } from './hooks/useArticles'
import { countries, getCountryByCode, orientationLabels, topics, trustLevelLabels, getSourceTrust, languageNames } from './lib/countries'
import { initDB, Article, getClaudeHistory, ClaudeRequest, ClaudeResponse } from './lib/db'
import { correlateArticles } from './lib/claude'

// Cross-regional analysis result interface
interface AnalysisResult {
  id: string
  timestamp: string
  articles: Article[]
  topic: string
  analysis: string
  perspectivesByCountry: Record<string, string>
  perspectivesByOrientation: Record<string, string>
  commonGround: string[]
  divergences: string[]
}

// Cluster/group information
interface ArticleCluster {
  id: string
  name: string
  articleIds: string[]
}

type View = 'feed' | 'correlate' | 'saved' | 'logs' | 'settings'

// Custom feed interface
interface CustomFeed {
  url: string
  name: string
  country: string
}

function App() {
  const auth = useAuth()
  const { preferences, updatePreferences, toggleCountry } = usePreferences()
  const articleHooks = useArticles()

  const [currentView, setCurrentView] = useState<View>('feed')
  const [showWizard, setShowWizard] = useState(false)
  const [wizardStep, setWizardStep] = useState(0)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showLanguage, setShowLanguage] = useState<Record<string, 'original' | 'translated'>>({})
  const [selectedTopic, setSelectedTopic] = useState<string>('all')
  const [translateLanguage, setTranslateLanguage] = useState('en')
  const [showTranslateConfirm, setShowTranslateConfirm] = useState(false)
  const [groupByStory, setGroupByStory] = useState(true)
  const [showTrendingOnly, setShowTrendingOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddFeed, setShowAddFeed] = useState(false)
  const [customFeeds, setCustomFeeds] = useState<CustomFeed[]>([])
  const [isTranslating, setIsTranslating] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [selectedSource, setSelectedSource] = useState<string | null>(null)
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([])
  const [currentAnalysisResult, setCurrentAnalysisResult] = useState<AnalysisResult | null>(null)
  const [articleClusters, setArticleClusters] = useState<ArticleCluster[]>([])
  const [showGroupModal, setShowGroupModal] = useState<string | null>(null) // Article ID to add to group
  const [showMergeModal, setShowMergeModal] = useState<string | null>(null) // Cluster ID to merge

  useEffect(() => {
    initDB()
    // Load custom feeds from localStorage
    const saved = localStorage.getItem('librenews-custom-feeds')
    if (saved) {
      setCustomFeeds(JSON.parse(saved))
    }
    // Load analysis history from localStorage
    const savedAnalyses = localStorage.getItem('librenews-analysis-history')
    if (savedAnalyses) {
      try {
        setAnalysisResults(JSON.parse(savedAnalyses))
      } catch (e) {
        console.error('Failed to load analysis history:', e)
      }
    }
  }, [])

  useEffect(() => {
    if (auth.isAuthenticated && preferences.selectedCountries.length === 0) {
      setShowWizard(true)
    }
  }, [auth.isAuthenticated, preferences.selectedCountries])

  useEffect(() => {
    if (auth.isAuthenticated) {
      articleHooks.loadArticles()
    }
  }, [auth.isAuthenticated])

  const handleSaveToStorage = async () => {
    setHasUnsavedChanges(false)
  }

  const toggleArticleLanguage = (articleId: string) => {
    setShowLanguage(prev => ({
      ...prev,
      [articleId]: prev[articleId] === 'translated' ? 'original' : 'translated'
    }))
  }

  const handleBulkTranslate = async () => {
    setShowTranslateConfirm(false)
    setIsTranslating(true)
    const untranslated = articleHooks.articles.filter(a => !a.translatedContent && a.originalLanguage !== translateLanguage)
    for (const article of untranslated) {
      await articleHooks.translateArticle(article.id, translateLanguage)
      setShowLanguage(prev => ({ ...prev, [article.id]: 'translated' }))
    }
    setIsTranslating(false)
    setHasUnsavedChanges(true)
  }

  const handleAddCustomFeed = (feed: CustomFeed) => {
    const newFeeds = [...customFeeds, feed]
    setCustomFeeds(newFeeds)
    localStorage.setItem('librenews-custom-feeds', JSON.stringify(newFeeds))
    setShowAddFeed(false)
  }

  const handleRemoveCustomFeed = (url: string) => {
    const newFeeds = customFeeds.filter(f => f.url !== url)
    setCustomFeeds(newFeeds)
    localStorage.setItem('librenews-custom-feeds', JSON.stringify(newFeeds))
  }

  // Handle cross-regional analysis
  const handleCrossRegionalAnalysis = async (articleIds: string[]) => {
    setIsAnalyzing(true)
    try {
      const selectedArticles = articleHooks.articles.filter(a => articleIds.includes(a.id))

      // Run the correlation analysis with political orientation
      const result = await correlateArticles(
        selectedArticles.map(a => ({
          title: a.title,
          content: a.content,
          source: a.source,
          country: getCountryByCode(a.country)?.name || a.country,
          orientation: a.orientation
        }))
      )

      // Create analysis result
      const analysisResult: AnalysisResult = {
        id: `analysis-${Date.now()}`,
        timestamp: new Date().toISOString(),
        articles: selectedArticles,
        ...result
      }

      setAnalysisResults(prev => {
        const newResults = [analysisResult, ...prev]
        // Persist to localStorage
        localStorage.setItem('librenews-analysis-history', JSON.stringify(newResults))
        return newResults
      })
      setCurrentAnalysisResult(analysisResult)
    } catch (err) {
      console.error('Analysis failed:', err)
    }
    setIsAnalyzing(false)
  }

  // Handle adding article to a group
  const handleAddToGroup = (articleId: string, clusterId: string, clusterName?: string) => {
    // Update the article's clusterId
    const article = articleHooks.articles.find(a => a.id === articleId)
    if (article) {
      articleHooks.updateArticle(articleId, { clusterId, clusterName })
    }

    // Update or create cluster
    setArticleClusters(prev => {
      const existing = prev.find(c => c.id === clusterId)
      if (existing) {
        return prev.map(c =>
          c.id === clusterId
            ? { ...c, articleIds: [...new Set([...c.articleIds, articleId])] }
            : c
        )
      } else {
        return [...prev, { id: clusterId, name: clusterName || 'New Group', articleIds: [articleId] }]
      }
    })
    setShowGroupModal(null)
  }

  // Create a new group with an article
  const handleCreateGroup = (articleId: string, groupName: string) => {
    const clusterId = `cluster-${Date.now()}`
    handleAddToGroup(articleId, clusterId, groupName)
  }

  // Get cluster name for display
  const getClusterDisplayName = (clusterId: string): string => {
    // Check explicit cluster state first
    const cluster = articleClusters.find(c => c.id === clusterId)
    if (cluster?.name) return cluster.name

    // Find articles with this cluster
    const clusterArticles = articleHooks.articles.filter(a => a.clusterId === clusterId)

    // Check if any article has a clusterName
    const articleWithName = clusterArticles.find(a => a.clusterName)
    if (articleWithName?.clusterName) return articleWithName.clusterName

    // Generate name from first article's title as fallback
    if (clusterArticles.length > 0) {
      const title = clusterArticles[0].title
      return title.length > 50 ? title.substring(0, 50) + '...' : title
    }

    return 'Related Stories'
  }

  // Handle merging two clusters
  const handleMergeClusters = async (sourceClusterId: string, targetClusterId: string, newName?: string) => {
    // Get all articles from source cluster
    const sourceArticles = articleHooks.articles.filter(a => a.clusterId === sourceClusterId)

    // Get target cluster name if not provided
    const targetName = newName || getClusterDisplayName(targetClusterId)

    // Update all source articles to point to target cluster
    for (const article of sourceArticles) {
      await articleHooks.updateArticle(article.id, {
        clusterId: targetClusterId,
        clusterName: targetName
      })
    }

    // Also update existing target articles with the new name if provided
    if (newName) {
      const targetArticles = articleHooks.articles.filter(a => a.clusterId === targetClusterId)
      for (const article of targetArticles) {
        await articleHooks.updateArticle(article.id, { clusterName: newName })
      }
    }

    // Update cluster state - remove source, update target
    setArticleClusters(prev => {
      const sourceCluster = prev.find(c => c.id === sourceClusterId)
      const targetCluster = prev.find(c => c.id === targetClusterId)

      if (sourceCluster && targetCluster) {
        return prev
          .filter(c => c.id !== sourceClusterId)
          .map(c => c.id === targetClusterId
            ? {
                ...c,
                name: newName || c.name,
                articleIds: [...new Set([...c.articleIds, ...sourceCluster.articleIds])]
              }
            : c
          )
      }
      return prev.filter(c => c.id !== sourceClusterId)
    })

    setShowMergeModal(null)
    setHasUnsavedChanges(true)
  }

  // Get all available clusters for merging (excluding the source)
  const getAvailableClustersForMerge = (sourceClusterId: string) => {
    // Get unique cluster IDs from articles
    const clusterIds = new Set<string>()
    for (const article of articleHooks.articles) {
      if (article.clusterId && article.clusterId !== sourceClusterId) {
        clusterIds.add(article.clusterId)
      }
    }

    return Array.from(clusterIds).map(id => ({
      id,
      name: getClusterDisplayName(id),
      articleCount: articleHooks.articles.filter(a => a.clusterId === id).length
    }))
  }

  // Calculate article counts per source
  const articleCountsBySource = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const article of articleHooks.articles) {
      counts[article.source] = (counts[article.source] || 0) + 1
    }
    return counts
  }, [articleHooks.articles])

  // Loading state
  if (auth.isLoading) {
    return (
      <div className="app loading">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    )
  }

  // Login screen
  if (!auth.isAuthenticated) {
    return <LoginScreen auth={auth} />
  }

  // Get active sources
  const activeSources = preferences.selectedCountries.flatMap(code => {
    const country = getCountryByCode(code)
    return country ? country.newspapers.map(n => ({ ...n, country: country })) : []
  })

  return (
    <div className="app">
      {/* Left Menu */}
      <nav className="left-menu">
        <div className="logo">LN</div>
        <div className="menu-items">
          <button
            className={`menu-btn ${currentView === 'feed' ? 'active' : ''}`}
            onClick={() => setCurrentView('feed')}
            title="News Feed"
          >
            &#9783;
          </button>
          <button
            className={`menu-btn ${currentView === 'correlate' ? 'active' : ''}`}
            onClick={() => setCurrentView('correlate')}
            title="Cross-Regional Analysis"
          >
            &#8644;
          </button>
          <button
            className={`menu-btn ${currentView === 'saved' ? 'active' : ''}`}
            onClick={() => setCurrentView('saved')}
            title="Saved Articles"
          >
            &#9733;
          </button>
          <button
            className={`menu-btn ${currentView === 'logs' ? 'active' : ''}`}
            onClick={() => setCurrentView('logs')}
            title="API Logs"
          >
            &#9776;
          </button>
        </div>
        <div className="menu-bottom">
          <button
            className={`menu-btn ${currentView === 'settings' ? 'active' : ''}`}
            onClick={() => setCurrentView('settings')}
            title="Settings"
          >
            &#9881;
          </button>
        </div>
      </nav>

      {/* Sources Panel */}
      <aside className="sources-panel">
        <div className="sources-header">
          Active Sources ({activeSources.length + customFeeds.length})
        </div>
        <div className="sources-list">
          {activeSources.length === 0 && customFeeds.length === 0 ? (
            <div style={{ padding: '16px', fontSize: '12px', color: '#666' }}>
              No sources selected.
              <button
                onClick={() => setShowWizard(true)}
                style={{ display: 'block', marginTop: '8px', color: '#0066cc', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
              >
                + Add countries
              </button>
            </div>
          ) : (
            <>
              {selectedSource && (
                <div className="source-filter-active">
                  <span>Filtering: {selectedSource}</span>
                  <button onClick={() => setSelectedSource(null)} title="Clear filter">×</button>
                </div>
              )}
              {activeSources.map((source, i) => {
                const orient = orientationLabels[source.orientation]
                const trust = trustLevelLabels[source.factCheckRecord]
                const count = articleCountsBySource[source.name] || 0
                const isSelected = selectedSource === source.name
                return (
                  <div
                    key={i}
                    className={`source-item clickable ${isSelected ? 'selected' : ''}`}
                    title={`${orient.full} | ${trust.label} (${source.trustworthiness}%) - Click to filter`}
                    onClick={() => setSelectedSource(isSelected ? null : source.name)}
                  >
                    <span className="source-flag">{source.country.flag}</span>
                    <span className="source-name">{source.name}</span>
                    <span className="source-count" title={`${count} articles`}>{count}</span>
                    <span className="source-trust-dot" style={{ background: trust.color }} title={trust.label} />
                    <span
                      className="source-orientation"
                      style={{ color: orient.color }}
                      title={orient.full}
                    >
                      {orient.short}
                    </span>
                  </div>
                )
              })}
              {customFeeds.map((feed, i) => {
                const isSelected = selectedSource === feed.name
                return (
                  <div
                    key={`custom-${i}`}
                    className={`source-item custom-feed clickable ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedSource(isSelected ? null : feed.name)}
                  >
                    <span className="source-flag">📡</span>
                    <span className="source-name">{feed.name}</span>
                    <span className="source-count">{articleCountsBySource[feed.name] || 0}</span>
                    <button
                      className="remove-feed-btn"
                      onClick={(e) => { e.stopPropagation(); handleRemoveCustomFeed(feed.url) }}
                      title="Remove feed"
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </>
          )}
        </div>
        <div className="sources-legend">
          <div className="legend-title">Orientation:</div>
          <div className="legend-items">
            {Object.entries(orientationLabels).map(([key, val]) => (
              <span key={key} className="legend-item" style={{ color: val.color }} title={val.full}>
                {val.short}
              </span>
            ))}
          </div>
          <div className="legend-title" style={{ marginTop: '8px' }}>Trust:</div>
          <div className="legend-items">
            {Object.entries(trustLevelLabels).map(([key, val]) => (
              <span key={key} className="legend-item">
                <span className="trust-dot" style={{ background: val.color }} />
                <span style={{ color: val.color, fontSize: '9px' }}>{val.label.split(' ')[0]}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="sources-actions">
          <button onClick={() => setShowWizard(true)}>
            Edit sources...
          </button>
          <button onClick={() => setShowAddFeed(true)}>
            + Add custom feed
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="top-bar">
          <h1>LibreNews</h1>

          {/* Search Bar */}
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search articles..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="clear-search" onClick={() => setSearchQuery('')}>×</button>
            )}
          </div>

          <div className="top-bar-spacer" />

          {/* Topic Filter */}
          <div className="top-bar-control">
            <label>Topic:</label>
            <select value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)}>
              <option value="all">All Topics</option>
              {topics.map(t => (
                <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
              ))}
              <option value="other">Other</option>
            </select>
          </div>

          {/* Translation Dropdown */}
          <div className="top-bar-control">
            <label>Translate to:</label>
            <select value={translateLanguage} onChange={e => setTranslateLanguage(e.target.value)}>
              {Object.entries(languageNames).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
            <button
              className={`translate-all-btn ${isTranslating ? 'working' : ''}`}
              onClick={() => setShowTranslateConfirm(true)}
              disabled={isTranslating}
              title="Translate all untranslated articles"
            >
              {isTranslating ? <span className="btn-spinner" /> : null}
              {isTranslating ? 'Translating...' : 'Translate All'}
            </button>
          </div>

          {/* Group Toggle */}
          <button
            className={`group-toggle-btn ${groupByStory ? 'active' : ''}`}
            onClick={() => setGroupByStory(!groupByStory)}
            title={groupByStory ? 'Show ungrouped' : 'Group related stories'}
          >
            {groupByStory ? '⊟ Grouped' : '⊞ Ungrouped'}
          </button>

          {/* Trending Toggle */}
          <button
            className={`trending-toggle-btn ${showTrendingOnly ? 'active' : ''}`}
            onClick={() => setShowTrendingOnly(!showTrendingOnly)}
            title={showTrendingOnly ? 'Show all stories' : 'Show only trending stories (covered by multiple sources/countries)'}
          >
            {showTrendingOnly ? '🔥 Trending Only' : '📰 All Stories'}
          </button>

          <button
            className={`refresh-btn ${articleHooks.isFetching ? 'working' : ''}`}
            onClick={() => articleHooks.fetchNews(preferences.selectedCountries)}
            disabled={articleHooks.isFetching || preferences.selectedCountries.length === 0}
            title={preferences.selectedCountries.length === 0 ? 'Select countries first' : 'Fetch latest news from all sources'}
          >
            {articleHooks.isFetching ? <span className="btn-spinner" /> : <span className="refresh-icon">↻</span>}
            <span className="refresh-text">
              {articleHooks.isFetching ? 'Fetching...' : 'Refresh'}
            </span>
          </button>
          <button
            className={`save-btn ${hasUnsavedChanges ? 'has-changes' : ''}`}
            onClick={handleSaveToStorage}
          >
            Save
          </button>
        </div>

        <div className="content-area">
          {currentView === 'feed' && (
            <FeedView
              articles={articleHooks.articles}
              showLanguage={showLanguage}
              toggleLanguage={toggleArticleLanguage}
              onSave={(id) => { articleHooks.toggleSaved(id); setHasUnsavedChanges(true) }}
              onDelete={(id) => { articleHooks.removeArticle(id); setHasUnsavedChanges(true) }}
              onAnalyze={async (id) => {
                await articleHooks.analyzeArticleBias(id)
                await articleHooks.assessArticleTrust(id)
                setHasUnsavedChanges(true)
              }}
              onTranslate={async (id) => {
                await articleHooks.translateArticle(id, translateLanguage)
                setShowLanguage(prev => ({ ...prev, [id]: 'translated' }))
                setHasUnsavedChanges(true)
              }}
              onAddArticle={() => setShowWizard(true)}
              onAddToGroup={(id) => setShowGroupModal(id)}
              onMergeCluster={(clusterId) => setShowMergeModal(clusterId)}
              onAnalyzeGroup={(articleIds) => {
                handleCrossRegionalAnalysis(articleIds)
                setCurrentView('correlate')
              }}
              isAnalyzingGroup={isAnalyzing}
              selectedTopic={selectedTopic}
              groupByStory={groupByStory}
              showTrendingOnly={showTrendingOnly}
              searchQuery={searchQuery}
              targetLanguage={translateLanguage}
              selectedSource={selectedSource}
            />
          )}
          {currentView === 'saved' && (
            <FeedView
              articles={articleHooks.articles.filter(a => a.saved)}
              showLanguage={showLanguage}
              toggleLanguage={toggleArticleLanguage}
              onSave={(id) => { articleHooks.toggleSaved(id); setHasUnsavedChanges(true) }}
              onDelete={(id) => { articleHooks.removeArticle(id); setHasUnsavedChanges(true) }}
              onAnalyze={async (id) => {
                await articleHooks.analyzeArticleBias(id)
                await articleHooks.assessArticleTrust(id)
              }}
              onTranslate={async (id) => {
                await articleHooks.translateArticle(id, translateLanguage)
                setShowLanguage(prev => ({ ...prev, [id]: 'translated' }))
              }}
              onAddToGroup={(id) => setShowGroupModal(id)}
              onMergeCluster={(clusterId) => setShowMergeModal(clusterId)}
              onAnalyzeGroup={(articleIds) => {
                handleCrossRegionalAnalysis(articleIds)
                setCurrentView('correlate')
              }}
              isAnalyzingGroup={isAnalyzing}
              title="Saved Articles"
              selectedTopic={selectedTopic}
              groupByStory={groupByStory}
              showTrendingOnly={showTrendingOnly}
              searchQuery={searchQuery}
              targetLanguage={translateLanguage}
              selectedSource={selectedSource}
            />
          )}
          {currentView === 'correlate' && (
            <CorrelationView
              articles={articleHooks.articles}
              searchQuery={searchQuery}
              targetLanguage={translateLanguage}
              onAnalyze={handleCrossRegionalAnalysis}
              isAnalyzing={isAnalyzing}
              analysisResult={currentAnalysisResult}
              analysisHistory={analysisResults}
              onViewResult={setCurrentAnalysisResult}
              selectedSource={selectedSource}
              selectedTopic={selectedTopic}
            />
          )}
          {currentView === 'logs' && <LogsView />}
          {currentView === 'settings' && (
            <SettingsView
              preferences={preferences}
              onUpdate={updatePreferences}
              onLogout={auth.logout}
              onManageCountries={() => setShowWizard(true)}
              selectedCountries={preferences.selectedCountries}
              authHook={auth}
            />
          )}
        </div>
      </main>

      {/* Setup Wizard */}
      {showWizard && (
        <SetupWizard
          selectedCountries={preferences.selectedCountries}
          onToggleCountry={(code) => { toggleCountry(code); setHasUnsavedChanges(true) }}
          onClose={() => setShowWizard(false)}
          step={wizardStep}
          setStep={setWizardStep}
        />
      )}

      {/* Translation Confirmation Modal */}
      {showTranslateConfirm && (
        <div className="modal-overlay" onClick={() => setShowTranslateConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Confirm Bulk Translation</h3>
            <p>
              This will translate {articleHooks.articles.filter(a => !a.translatedContent && a.originalLanguage !== translateLanguage).length} articles
              to {languageNames[translateLanguage] || translateLanguage}.
            </p>
            <p className="modal-warning">
              This will use your Claude API credits. Estimated cost: ~${(articleHooks.articles.filter(a => !a.translatedContent).length * 0.01).toFixed(2)}
            </p>
            <div className="modal-actions">
              <button onClick={() => setShowTranslateConfirm(false)}>Cancel</button>
              <button className="primary" onClick={handleBulkTranslate}>Translate All</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Feed Modal */}
      {showAddFeed && (
        <AddFeedModal
          onAdd={handleAddCustomFeed}
          onClose={() => setShowAddFeed(false)}
        />
      )}

      {/* Group Modal */}
      {showGroupModal && (
        <GroupModal
          articleId={showGroupModal}
          articleTitle={articleHooks.articles.find(a => a.id === showGroupModal)?.title || ''}
          existingClusters={articleClusters}
          onAddToGroup={(clusterId) => {
            const cluster = articleClusters.find(c => c.id === clusterId)
            handleAddToGroup(showGroupModal, clusterId, cluster?.name)
          }}
          onCreateGroup={(groupName) => handleCreateGroup(showGroupModal, groupName)}
          onClose={() => setShowGroupModal(null)}
        />
      )}

      {/* Merge Cluster Modal */}
      {showMergeModal && (
        <MergeModal
          sourceClusterId={showMergeModal}
          sourceClusterName={getClusterDisplayName(showMergeModal)}
          availableClusters={getAvailableClustersForMerge(showMergeModal)}
          onMerge={(targetClusterId, newName) => handleMergeClusters(showMergeModal, targetClusterId, newName)}
          onClose={() => setShowMergeModal(null)}
        />
      )}
    </div>
  )
}

// Add Feed Modal Component
function AddFeedModal({ onAdd, onClose }: { onAdd: (feed: CustomFeed) => void; onClose: () => void }) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [country, setCountry] = useState('custom')
  const [isValidating, setIsValidating] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [validationSuccess, setValidationSuccess] = useState(false)

  const validateFeed = async () => {
    if (!url) {
      setValidationError('Please enter a URL')
      return
    }

    setIsValidating(true)
    setValidationError(null)
    setValidationSuccess(false)

    try {
      // Try to fetch the RSS feed to validate it
      const result = await window.electronAPI.rss.fetch([{
        rssUrl: url,
        sourceName: name || 'Test',
        country: country,
        orientation: 'center',
        language: 'en',
        trustworthiness: 50,
        factCheckRecord: 'unknown'
      }])

      if (result && result.length > 0) {
        setValidationSuccess(true)
        setValidationError(null)
      } else {
        setValidationError('Feed returned no articles. The URL may be invalid or the feed format is not supported.')
      }
    } catch (err: any) {
      const errorMessage = err?.message || String(err)
      if (errorMessage.includes('CORS') || errorMessage.includes('network')) {
        setValidationError('Network error: Could not reach the feed URL. Check if the URL is correct and accessible.')
      } else if (errorMessage.includes('parse') || errorMessage.includes('XML')) {
        setValidationError('Parse error: The URL does not contain valid RSS/Atom feed data.')
      } else if (errorMessage.includes('404')) {
        setValidationError('Not found: The feed URL returned a 404 error.')
      } else if (errorMessage.includes('403') || errorMessage.includes('401')) {
        setValidationError('Access denied: The feed requires authentication or blocks automated access.')
      } else {
        setValidationError(`Failed to fetch feed: ${errorMessage}`)
      }
    }

    setIsValidating(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url || !name) return

    // If not validated yet, validate first
    if (!validationSuccess) {
      await validateFeed()
      // Check if validation succeeded after the call
      if (!validationSuccess) {
        return // Don't add if validation failed
      }
    }

    onAdd({ url, name, country })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal add-feed-modal" onClick={e => e.stopPropagation()}>
        <h3>Add Custom RSS Feed</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Feed Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., My Local News"
              required
            />
          </div>
          <div className="form-group">
            <label>RSS URL</label>
            <div className="url-input-row">
              <input
                type="url"
                value={url}
                onChange={e => { setUrl(e.target.value); setValidationSuccess(false); setValidationError(null) }}
                placeholder="https://example.com/rss.xml"
                required
              />
              <button
                type="button"
                className={`validate-btn ${isValidating ? 'validating' : ''} ${validationSuccess ? 'success' : ''}`}
                onClick={validateFeed}
                disabled={isValidating || !url}
              >
                {isValidating ? 'Checking...' : validationSuccess ? '✓ Valid' : 'Test Feed'}
              </button>
            </div>
            {validationError && (
              <div className="validation-error">{validationError}</div>
            )}
            {validationSuccess && (
              <div className="validation-success">✓ Feed is accessible and contains articles</div>
            )}
          </div>
          <div className="form-group">
            <label>Country (optional)</label>
            <select value={country} onChange={e => setCountry(e.target.value)}>
              <option value="custom">Custom / Other</option>
              {countries.map(c => (
                <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
              ))}
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="primary"
              disabled={isValidating}
            >
              {isValidating ? 'Validating...' : 'Add Feed'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Login Screen Component
function LoginScreen({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const [apiKey, setApiKey] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [confirmPassphrase, setConfirmPassphrase] = useState('')
  const [isNewUser, setIsNewUser] = useState(!auth.hasStoredKey)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isNewUser) {
      if (passphrase !== confirmPassphrase) {
        alert('Passphrases do not match')
        return
      }
      if (passphrase.length < 8) {
        alert('Passphrase must be at least 8 characters')
        return
      }
      await auth.login(apiKey, passphrase)
    } else {
      await auth.unlock(passphrase)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-left">
        <h1>LibreNews</h1>
        <p className="tagline">AI-Powered Cross-Regional News Analysis</p>

        <form className="login-form" onSubmit={handleSubmit}>
          {isNewUser ? (
            <>
              <div className="form-group">
                <label>Anthropic API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  required
                />
                <small>Get your key at console.anthropic.com</small>
              </div>
              <div className="form-group">
                <label>Create Passphrase</label>
                <input
                  type="password"
                  value={passphrase}
                  onChange={e => setPassphrase(e.target.value)}
                  placeholder="Min 8 characters"
                  minLength={8}
                  required
                />
              </div>
              <div className="form-group">
                <label>Confirm Passphrase</label>
                <input
                  type="password"
                  value={confirmPassphrase}
                  onChange={e => setConfirmPassphrase(e.target.value)}
                  placeholder="Re-enter passphrase"
                  required
                />
              </div>
            </>
          ) : (
            <div className="form-group">
              <label>Passphrase</label>
              <input
                type="password"
                value={passphrase}
                onChange={e => setPassphrase(e.target.value)}
                placeholder="Enter your passphrase"
                required
              />
            </div>
          )}

          {auth.error && <div className="login-error">{auth.error}</div>}

          <button type="submit" className="login-btn" disabled={auth.isLoading}>
            {auth.isLoading ? 'Please wait...' : isNewUser ? 'Get Started' : 'Unlock'}
          </button>

          {auth.hasStoredKey && (
            <button
              type="button"
              onClick={() => setIsNewUser(!isNewUser)}
              style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '13px', marginTop: '8px' }}
            >
              {isNewUser ? 'Use existing credentials' : 'Set up new API key'}
            </button>
          )}
        </form>
      </div>
      <div className="login-right">
        Your API key is encrypted locally with AES-256
      </div>
    </div>
  )
}

// Feed View Component
function FeedView({
  articles,
  showLanguage,
  toggleLanguage,
  onSave,
  onDelete,
  onAnalyze,
  onTranslate,
  onAddArticle,
  onAddToGroup,
  onMergeCluster,
  onAnalyzeGroup,
  isAnalyzingGroup = false,
  title = 'News Feed',
  selectedTopic = 'all',
  groupByStory = true,
  showTrendingOnly = false,
  searchQuery = '',
  targetLanguage = 'en',
  selectedSource = null
}: {
  articles: Article[]
  showLanguage: Record<string, 'original' | 'translated'>
  toggleLanguage: (id: string) => void
  onSave: (id: string) => void
  onDelete: (id: string) => void
  onAnalyze: (id: string) => void
  onTranslate: (id: string) => void
  onAddArticle?: () => void
  onAddToGroup?: (id: string) => void
  onMergeCluster?: (clusterId: string) => void
  onAnalyzeGroup?: (articleIds: string[]) => void
  isAnalyzingGroup?: boolean
  title?: string
  selectedTopic?: string
  groupByStory?: boolean
  showTrendingOnly?: boolean
  searchQuery?: string
  targetLanguage?: string
  selectedSource?: string | null
}) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [translatingId, setTranslatingId] = useState<string | null>(null)

  // Filter by topic, trending, search, and source
  const filteredArticles = useMemo(() => {
    let result = articles
    if (selectedSource) {
      result = result.filter(a => a.source === selectedSource)
    }
    if (selectedTopic !== 'all') {
      result = result.filter(a => a.topic === selectedTopic)
    }
    if (showTrendingOnly) {
      result = result.filter(a => a.isTrending)
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(a =>
        a.title.toLowerCase().includes(query) ||
        a.content.toLowerCase().includes(query) ||
        a.source.toLowerCase().includes(query) ||
        (a.translatedContent?.toLowerCase().includes(query))
      )
    }
    return result
  }, [articles, selectedTopic, showTrendingOnly, searchQuery, selectedSource])

  // Count trending articles
  const trendingCount = useMemo(() => {
    return articles.filter(a => a.isTrending).length
  }, [articles])

  // Group articles by cluster and sort by group size (multi-article groups first)
  const groupedArticles = useMemo(() => {
    if (!groupByStory) {
      return filteredArticles.map(a => ({ articles: [a], clusterId: '' }))
    }

    const clusters: Record<string, Article[]> = {}
    const ungrouped: Article[] = []

    for (const article of filteredArticles) {
      if (article.clusterId) {
        if (!clusters[article.clusterId]) {
          clusters[article.clusterId] = []
        }
        clusters[article.clusterId].push(article)
      } else {
        ungrouped.push(article)
      }
    }

    const result = [
      ...Object.entries(clusters).map(([clusterId, arts]) => ({ clusterId, articles: arts })),
      ...ungrouped.map(a => ({ clusterId: '', articles: [a] }))
    ]

    // Sort: multi-article groups first, then by date
    return result.sort((a, b) => {
      // First priority: groups with more articles
      if (a.articles.length > 1 && b.articles.length === 1) return -1
      if (a.articles.length === 1 && b.articles.length > 1) return 1
      // Second priority: larger groups first
      if (a.articles.length !== b.articles.length) return b.articles.length - a.articles.length
      // Third priority: by date
      const dateA = new Date(a.articles[0].publishedAt).getTime()
      const dateB = new Date(b.articles[0].publishedAt).getTime()
      return dateB - dateA
    })
  }, [filteredArticles, groupByStory])

  const topicInfo = topics.find(t => t.id === selectedTopic)

  const handleAnalyze = async (id: string) => {
    setAnalyzingId(id)
    await onAnalyze(id)
    setAnalyzingId(null)
  }

  const handleTranslate = async (id: string) => {
    setTranslatingId(id)
    await onTranslate(id)
    setTranslatingId(null)
  }

  return (
    <div>
      <div className="feed-header">
        <h2>{title}</h2>
        <span className="feed-date">{today}</span>
        {selectedTopic !== 'all' && topicInfo && (
          <span className="feed-topic-badge">{topicInfo.icon} {topicInfo.label}</span>
        )}
        {showTrendingOnly && (
          <span className="feed-trending-badge">🔥 Trending Only</span>
        )}
        {searchQuery && (
          <span className="feed-search-badge">🔍 "{searchQuery}"</span>
        )}
        {selectedSource && (
          <span className="feed-source-badge">📰 {selectedSource}</span>
        )}
        <span className="feed-count">{filteredArticles.length} articles {trendingCount > 0 && !showTrendingOnly && `(${trendingCount} trending)`}</span>
      </div>

      {filteredArticles.length === 0 ? (
        <div className="empty-state">
          <h3>No articles yet</h3>
          <p>{searchQuery ? 'No articles match your search' : 'Select countries and sources to start collecting news'}</p>
          {onAddArticle && !searchQuery && (
            <button onClick={onAddArticle}>Configure Sources</button>
          )}
        </div>
      ) : (
        <div className="articles-grouped">
          {groupedArticles.map((group, groupIdx) => {
            // Get cluster name from first article or generate from title
            let clusterName = group.articles[0]?.clusterName
            if (!clusterName && group.articles.length > 1) {
              // Generate a simple name from the first article title
              const title = group.articles[0]?.title || ''
              clusterName = title.length > 50 ? title.substring(0, 50) + '...' : title
            }
            clusterName = clusterName || 'Related Stories'
            return (
              <div key={groupIdx} className={`article-group ${group.articles.length > 1 ? 'multi' : ''}`}>
                {group.articles.length > 1 && (
                  <div className="group-header">
                    <span className="group-icon">&#128279;</span>
                    <span className="group-name">{clusterName}</span>
                    <span className="group-count">{group.articles.length} sources</span>
                    {group.articles[0]?.isTrending && (
                      <span className="trending-badge" title={`Trending Score: ${group.articles[0]?.trendingScore}`}>
                        🔥 Trending
                      </span>
                    )}
                    {onAnalyzeGroup && group.articles.length >= 2 && (
                      <button
                        className="analyze-group-btn"
                        onClick={() => onAnalyzeGroup(group.articles.map(a => a.id))}
                        disabled={isAnalyzingGroup}
                        title="Run cross-regional analysis on this group"
                      >
                        {isAnalyzingGroup ? '⏳ Analyzing...' : '🔍 Analyze Group'}
                      </button>
                    )}
                    {onMergeCluster && group.clusterId && (
                      <button
                        className="merge-btn"
                        onClick={() => onMergeCluster(group.clusterId)}
                        title="Merge with another group"
                      >
                        ⊕ Merge
                      </button>
                    )}
                  </div>
                )}
                <div className="group-articles">
                  {group.articles.map(article => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      showLanguage={showLanguage[article.id] || (article.originalLanguage === 'en' ? 'original' : 'translated')}
                      onToggleLanguage={() => toggleLanguage(article.id)}
                      onSave={() => onSave(article.id)}
                      onDelete={() => onDelete(article.id)}
                      onAnalyze={() => handleAnalyze(article.id)}
                      onTranslate={() => handleTranslate(article.id)}
                      onAddToGroup={onAddToGroup ? () => onAddToGroup(article.id) : undefined}
                      isGrouped={group.articles.length > 1}
                      isAnalyzing={analyzingId === article.id}
                      isTranslating={translatingId === article.id}
                      targetLanguage={targetLanguage}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Article Card Component
function ArticleCard({
  article,
  showLanguage,
  onToggleLanguage,
  onSave,
  onDelete,
  onAnalyze,
  onTranslate,
  onAnalyzeImage,
  onAddToGroup,
  isGrouped,
  isAnalyzing = false,
  isTranslating = false,
  isAnalyzingImage = false,
  targetLanguage = 'en'
}: {
  article: Article
  showLanguage: 'original' | 'translated'
  onToggleLanguage: () => void
  onSave: () => void
  onDelete: () => void
  onAnalyze: () => void
  onTranslate: () => void
  onAnalyzeImage?: () => void
  onAddToGroup?: () => void
  isGrouped: boolean
  isAnalyzing?: boolean
  isTranslating?: boolean
  isAnalyzingImage?: boolean
  targetLanguage?: string
}) {
  const country = getCountryByCode(article.country)
  const orient = orientationLabels[article.orientation]
  const sourceTrust = getSourceTrust(article.source)
  const trustLevel = sourceTrust ? trustLevelLabels[sourceTrust.factCheckRecord] : null
  const topicInfo = topics.find(t => t.id === article.topic)

  const displayContent = showLanguage === 'translated' && article.translatedContent
    ? article.translatedContent
    : article.content

  // Show translated title if available
  const displayTitle = showLanguage === 'translated' && article.translatedTitle
    ? article.translatedTitle
    : article.title

  return (
    <article className={`article ${isGrouped ? 'grouped' : ''}`}>
      {/* Article Image (if available) */}
      {article.imageUrl && (
        <div className="article-image">
          <img
            src={article.imageUrl}
            alt=""
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          {article.imageAnalysis && article.imageAnalysis.misleadingScore > 30 && (
            <div className="image-warning" title={article.imageAnalysis.explanation}>
              ⚠️ Image may be misleading
            </div>
          )}
        </div>
      )}

      {/* Source Header */}
      <div className="article-source">
        <span className="flag">{country?.flag}</span>
        <span className="source-name">{article.source}</span>
        {trustLevel && (
          <span
            className="source-trust-badge"
            style={{ background: trustLevel.color }}
            title={`${trustLevel.label} - ${sourceTrust?.trustworthiness}% reliability`}
          >
            {sourceTrust?.trustworthiness}%
          </span>
        )}
        <span
          className="source-orient-badge"
          style={{ color: orient.color, borderColor: orient.color }}
          title={orient.full}
        >
          {orient.short}
        </span>
        <span className="article-lang" title={`Original language: ${languageNames[article.originalLanguage] || article.originalLanguage}`}>
          {article.originalLanguage.toUpperCase()}
        </span>
      </div>

      {/* Topic Badge */}
      {topicInfo && (
        <div className="article-topic">
          <span className="topic-badge">
            {topicInfo.icon} {topicInfo.label}
            {article.topicConfidence && article.topicConfidence > 0.7 && (
              <span className="confidence-high" title="High confidence">&#10003;</span>
            )}
          </span>
        </div>
      )}

      <h3>{displayTitle}</h3>

      <p className="article-excerpt">
        {displayContent.substring(0, 250)}...
      </p>

      {/* PROMINENT Fake News Warning - Stand out more */}
      {article.fakeNewsScore !== undefined && article.fakeNewsScore > 30 && (
        <div className={`fake-news-alert ${article.fakeNewsScore > 70 ? 'critical' : article.fakeNewsScore > 50 ? 'high' : 'moderate'}`}>
          <span className="fake-news-icon">⚠️</span>
          <span className="fake-news-label">
            {article.fakeNewsScore > 70 ? 'HIGH MISINFORMATION RISK' :
             article.fakeNewsScore > 50 ? 'ELEVATED MISINFORMATION RISK' :
             'POTENTIAL MISINFORMATION'}
          </span>
          <span className="fake-news-score">{article.fakeNewsScore}%</span>
        </div>
      )}

      {/* Indicators Row */}
      <div className="article-indicators">
        {article.trustScore !== undefined && (
          <span
            className={`indicator trust ${article.trustScore >= 70 ? 'high' : article.trustScore >= 40 ? 'medium' : 'low'}`}
            title="Source reliability score"
          >
            Trust: {article.trustScore}%
          </span>
        )}
        {article.biasAnalysis && (
          <span className="indicator bias" title={article.biasAnalysis.explanation}>
            Bias: {article.biasAnalysis.score > 0.3 ? 'Right' : article.biasAnalysis.score < -0.3 ? 'Left' : 'Center'}
          </span>
        )}
        {article.fakeNewsScore !== undefined && article.fakeNewsScore <= 30 && (
          <span className="indicator fake ok" title="Low misinformation risk">
            ✓ Low Misinfo Risk
          </span>
        )}
        {article.imageAnalysis && (
          <span
            className={`indicator image ${article.imageAnalysis.misleadingScore > 50 ? 'warning' : 'ok'}`}
            title={article.imageAnalysis.explanation}
          >
            Image: {article.imageAnalysis.misleadingScore > 50 ? '⚠️ Suspicious' : '✓ OK'}
          </span>
        )}
      </div>

      {/* Translation Available Indicator */}
      {article.translatedContent && (
        <div className="translation-available">
          <span className="translation-icon">🌐</span>
          <span>Translated to {languageNames[article.targetLanguage || 'en'] || article.targetLanguage}</span>
        </div>
      )}

      {/* Meta & Language Toggle */}
      <div className="article-meta">
        <span className="date">{new Date(article.publishedAt).toLocaleDateString()}</span>
        <a href={article.url} target="_blank" rel="noopener noreferrer" className="article-link">
          Read original &#8599;
        </a>
        <div className="language-toggle">
          <button
            className={showLanguage !== 'translated' ? 'active' : ''}
            onClick={onToggleLanguage}
            disabled={!article.translatedContent}
            title={article.translatedContent ? 'Show original' : 'Not yet translated'}
          >
            {article.originalLanguage.toUpperCase()}
          </button>
          <button
            className={showLanguage === 'translated' ? 'active' : ''}
            onClick={onToggleLanguage}
            disabled={!article.translatedContent}
          >
            {article.targetLanguage?.toUpperCase() || 'EN'}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="article-actions">
        <button className={article.saved ? 'saved' : ''} onClick={onSave}>
          {article.saved ? '★ Saved' : '☆ Save'}
        </button>
        {onAddToGroup && (
          <button onClick={onAddToGroup} className="group-btn" title="Add to a group">
            📁 Group
          </button>
        )}
        {!article.translatedContent && (
          <button
            onClick={onTranslate}
            disabled={isTranslating}
            className={isTranslating ? 'working' : ''}
          >
            {isTranslating ? <><span className="btn-spinner-sm" /> Translating...</> : 'Translate'}
          </button>
        )}
        {!article.biasAnalysis && (
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className={isAnalyzing ? 'working' : ''}
          >
            {isAnalyzing ? <><span className="btn-spinner-sm" /> Analyzing...</> : 'Analyze'}
          </button>
        )}
        {article.imageUrl && !article.imageAnalysis && onAnalyzeImage && (
          <button
            onClick={onAnalyzeImage}
            disabled={isAnalyzingImage}
            className={isAnalyzingImage ? 'working' : ''}
          >
            {isAnalyzingImage ? <><span className="btn-spinner-sm" /> Checking...</> : '🖼️ Check Image'}
          </button>
        )}
        <button className="delete" onClick={onDelete}>Delete</button>
      </div>
    </article>
  )
}

// Correlation View with suggested analysis and results
function CorrelationView({
  articles,
  searchQuery = '',
  targetLanguage = 'en',
  onAnalyze,
  isAnalyzing = false,
  analysisResult,
  analysisHistory = [],
  onViewResult,
  selectedSource = null,
  selectedTopic = 'all'
}: {
  articles: Article[]
  searchQuery?: string
  targetLanguage?: string
  onAnalyze: (ids: string[]) => Promise<void>
  isAnalyzing?: boolean
  analysisResult?: AnalysisResult | null
  analysisHistory?: AnalysisResult[]
  onViewResult?: (result: AnalysisResult | null) => void
  selectedSource?: string | null
  selectedTopic?: string
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'select' | 'result' | 'history'>('select')
  const [showAllHistory, setShowAllHistory] = useState(false)

  // Switch to result view when analysis completes
  useEffect(() => {
    if (analysisResult && !isAnalyzing) {
      setViewMode('result')
    }
  }, [analysisResult, isAnalyzing])

  // Filter by search, source, and topic
  const filteredArticles = useMemo(() => {
    let result = articles
    if (selectedSource) {
      result = result.filter(a => a.source === selectedSource)
    }
    if (selectedTopic !== 'all') {
      result = result.filter(a => a.topic === selectedTopic)
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(a =>
        a.title.toLowerCase().includes(query) ||
        a.content.toLowerCase().includes(query) ||
        a.source.toLowerCase().includes(query)
      )
    }
    return result
  }, [articles, searchQuery, selectedSource, selectedTopic])

  // Generate suggested cross-regional analyses
  const suggestedAnalyses = useMemo(() => {
    const suggestions: Array<{ title: string; description: string; articleIds: string[]; countries: string[]; topic: string; confidence: number }> = []

    // Find clusters with articles from multiple countries
    const clusterMap: Record<string, Article[]> = {}
    for (const article of articles) {
      if (article.clusterId) {
        if (!clusterMap[article.clusterId]) clusterMap[article.clusterId] = []
        clusterMap[article.clusterId].push(article)
      }
    }

    // Suggest analysis for multi-country clusters with topic validation
    for (const [clusterId, clusterArticles] of Object.entries(clusterMap)) {
      const uniqueCountries = [...new Set(clusterArticles.map(a => a.country))]

      // Only suggest if articles are from multiple countries
      if (uniqueCountries.length < 2) continue

      // Validate topic consistency - all articles should have the same topic
      const topics = clusterArticles.map(a => a.topic).filter(Boolean)
      const topicCounts: Record<string, number> = {}
      for (const topic of topics) {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1
      }

      // Find the dominant topic
      const dominantTopic = Object.entries(topicCounts).sort((a, b) => b[1] - a[1])[0]
      const topicConsistency = dominantTopic ? dominantTopic[1] / clusterArticles.length : 0

      // Skip if less than 60% of articles share the same topic
      if (topicConsistency < 0.6) continue

      // Additional validation: check for keyword overlap in titles
      const titleWords = clusterArticles.map(a =>
        new Set(a.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 4))
      )

      // Find common words across all titles
      let commonWords = new Set(titleWords[0])
      for (let i = 1; i < titleWords.length; i++) {
        commonWords = new Set([...commonWords].filter(w => titleWords[i].has(w)))
      }

      // Require at least one significant common word, or same topic with high confidence
      const avgTopicConfidence = clusterArticles.reduce((sum, a) => sum + (a.topicConfidence || 0), 0) / clusterArticles.length
      if (commonWords.size === 0 && avgTopicConfidence < 0.7) continue

      const countryNames = uniqueCountries.map(c => getCountryByCode(c)?.name || c).join(', ')
      const clusterName = clusterArticles[0].clusterName || clusterArticles[0].title.substring(0, 60) + '...'

      suggestions.push({
        title: clusterName,
        description: `Compare coverage from ${countryNames}`,
        articleIds: clusterArticles.map(a => a.id),
        countries: uniqueCountries,
        topic: dominantTopic ? dominantTopic[0] : 'unknown',
        confidence: Math.max(topicConsistency, avgTopicConfidence)
      })
    }

    // Sort by confidence first, then by number of countries
    return suggestions
      .sort((a, b) => {
        if (Math.abs(a.confidence - b.confidence) > 0.1) return b.confidence - a.confidence
        return b.countries.length - a.countries.length
      })
      .slice(0, 5)
  }, [articles])

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleAnalyze = () => {
    if (selected.length >= 2) {
      onAnalyze(selected)
    }
  }

  // Render full history view
  if (viewMode === 'history') {
    return (
      <div className="correlation-page">
        <div className="analysis-header">
          <button className="back-btn" onClick={() => setViewMode('select')}>
            ← Back to Selection
          </button>
          <h2>Analysis History</h2>
          <span className="history-count">{analysisHistory.length} analyses</span>
        </div>

        <div className="full-history-list">
          {analysisHistory.length === 0 ? (
            <div className="empty-history">
              <p>No previous analyses yet.</p>
              <p>Select articles and run a cross-regional analysis to see results here.</p>
            </div>
          ) : (
            analysisHistory.map(result => (
              <div
                key={result.id}
                className="history-card"
                onClick={() => { onViewResult?.(result); setViewMode('result') }}
              >
                <div className="history-card-header">
                  <h4>{result.topic}</h4>
                  <span className="history-card-date">
                    {new Date(result.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="history-card-meta">
                  <span className="history-card-articles">
                    {result.articles.length} articles analyzed
                  </span>
                  <span className="history-card-countries">
                    {Object.keys(result.perspectivesByCountry).length} countries compared
                  </span>
                </div>
                <p className="history-card-preview">
                  {result.analysis.substring(0, 150)}...
                </p>
                <div className="history-card-countries-flags">
                  {Object.keys(result.perspectivesByCountry).map(countryCode => {
                    const country = getCountryByCode(countryCode)
                    return <span key={countryCode} className="country-flag" title={country?.name}>{country?.flag}</span>
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // Render analysis result view
  if (viewMode === 'result' && analysisResult) {
    return (
      <div className="correlation-page">
        <div className="analysis-header">
          <button className="back-btn" onClick={() => { setViewMode('select'); onViewResult?.(null) }}>
            ← Back to Selection
          </button>
          <h2>Analysis Results</h2>
          <span className="analysis-date">{new Date(analysisResult.timestamp).toLocaleString()}</span>
        </div>

        {/* Analysis History Sidebar */}
        {analysisHistory.length > 1 && (
          <div className="analysis-history">
            <h4>Previous Analyses</h4>
            <div className="history-list">
              {analysisHistory.slice(0, 5).map((hist, i) => (
                <button
                  key={hist.id}
                  className={`history-item ${hist.id === analysisResult.id ? 'active' : ''}`}
                  onClick={() => onViewResult?.(hist)}
                >
                  <span className="hist-topic">{hist.topic.substring(0, 30)}...</span>
                  <span className="hist-date">{new Date(hist.timestamp).toLocaleDateString()}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Topic Summary */}
        <div className="analysis-topic">
          <h3>{analysisResult.topic}</h3>
        </div>

        {/* Overall Analysis */}
        <div className="analysis-section">
          <h4>Cross-Regional Analysis</h4>
          <p className="analysis-text">{analysisResult.analysis}</p>
        </div>

        {/* Articles Compared */}
        <div className="analysis-section">
          <h4>Articles Compared ({analysisResult.articles.length})</h4>
          <div className="compared-articles">
            {analysisResult.articles.map(article => {
              const country = getCountryByCode(article.country)
              const orient = orientationLabels[article.orientation]
              const sourceTrust = getSourceTrust(article.source)
              const trustLevel = sourceTrust ? trustLevelLabels[sourceTrust.factCheckRecord] : null
              const topicInfo = topics.find(t => t.id === article.topic)

              return (
                <div key={article.id} className="compared-article">
                  {/* Article Image */}
                  {article.imageUrl && (
                    <div className="compared-article-image">
                      <img src={article.imageUrl} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    </div>
                  )}
                  <div className="compared-header">
                    <span className="flag">{country?.flag}</span>
                    <span className="source">{article.source}</span>
                    <span className="lang-badge" title={`Original language: ${languageNames[article.originalLanguage] || article.originalLanguage}`}>
                      {article.originalLanguage.toUpperCase()}
                    </span>
                    {trustLevel && (
                      <span className="trust-badge" style={{ background: trustLevel.color }}>
                        Trust: {sourceTrust?.trustworthiness}%
                      </span>
                    )}
                    <span className="orient-badge" style={{ color: orient.color, borderColor: orient.color }}>
                      {orient.full}
                    </span>
                    {article.translatedContent && (
                      <span className="translated-badge" title={`Translated to ${languageNames[article.targetLanguage || 'en']}`}>
                        🌐 {article.targetLanguage?.toUpperCase() || 'EN'}
                      </span>
                    )}
                  </div>
                  <h5>{article.title}</h5>
                  <p className="article-excerpt">{article.content.substring(0, 200)}...</p>

                  {/* Prominent Fake News Warning */}
                  {article.fakeNewsScore !== undefined && article.fakeNewsScore > 30 && (
                    <div className={`fake-news-alert-mini ${article.fakeNewsScore > 70 ? 'critical' : article.fakeNewsScore > 50 ? 'high' : 'moderate'}`}>
                      ⚠️ {article.fakeNewsScore > 70 ? 'HIGH MISINFO RISK' : article.fakeNewsScore > 50 ? 'ELEVATED MISINFO RISK' : 'POTENTIAL MISINFO'}: {article.fakeNewsScore}%
                    </div>
                  )}

                  <div className="article-indicators-row">
                    {topicInfo && (
                      <span className="indicator-mini">{topicInfo.icon} {topicInfo.label}</span>
                    )}
                    {article.biasAnalysis && (
                      <span className="indicator-mini bias">
                        Bias: {article.biasAnalysis.score > 0.3 ? 'Right' : article.biasAnalysis.score < -0.3 ? 'Left' : 'Center'}
                      </span>
                    )}
                    {article.trustScore !== undefined && (
                      <span className={`indicator-mini trust ${article.trustScore >= 70 ? 'high' : article.trustScore >= 40 ? 'medium' : 'low'}`}>
                        Trust: {article.trustScore}%
                      </span>
                    )}
                    {article.fakeNewsScore !== undefined && article.fakeNewsScore <= 30 && (
                      <span className="indicator-mini ok">
                        ✓ Low Misinfo Risk
                      </span>
                    )}
                  </div>

                  {/* Original Article Link */}
                  <div className="compared-article-link">
                    <a href={article.url} target="_blank" rel="noopener noreferrer">
                      Read original article ↗
                    </a>
                  </div>

                  {/* Country-specific perspective */}
                  {analysisResult.perspectivesByCountry[country?.name || article.country] && (
                    <div className="country-perspective">
                      <strong>{country?.name} Perspective:</strong>
                      <p>{analysisResult.perspectivesByCountry[country?.name || article.country]}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Perspectives by Political Orientation */}
        {analysisResult.perspectivesByOrientation && Object.keys(analysisResult.perspectivesByOrientation).length > 0 && (
          <div className="analysis-section political-perspectives">
            <h4>⚖️ Analysis by Political Orientation</h4>
            <p className="section-description">How different political leanings frame this story:</p>
            <div className="orientation-perspectives">
              {Object.entries(analysisResult.perspectivesByOrientation).map(([orientation, perspective]) => {
                const orientInfo = orientationLabels[orientation as keyof typeof orientationLabels]
                return (
                  <div key={orientation} className="orientation-card">
                    <div className="orientation-header" style={{ borderColor: orientInfo?.color || '#666' }}>
                      <span className="orientation-label" style={{ color: orientInfo?.color || '#666' }}>
                        {orientInfo?.full || orientation}
                      </span>
                    </div>
                    <p className="orientation-text">{perspective}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Common Ground */}
        {analysisResult.commonGround.length > 0 && (
          <div className="analysis-section common-ground">
            <h4>Common Ground</h4>
            <ul>
              {analysisResult.commonGround.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Divergences */}
        {analysisResult.divergences.length > 0 && (
          <div className="analysis-section divergences">
            <h4>Key Divergences</h4>
            <ul>
              {analysisResult.divergences.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  // Selection view
  return (
    <div className="correlation-page">
      <h2>Cross-Regional Analysis</h2>
      <p>Select articles from different countries to compare coverage, or use suggested analyses below.</p>

      {/* Analysis Control Panel - Always visible at top */}
      <div className="analysis-control-panel">
        <div className="control-panel-left">
          <span className="selection-count">
            {selected.length} article{selected.length !== 1 ? 's' : ''} selected
          </span>
          {selected.length > 0 && (
            <button
              className="clear-selection-btn-small"
              onClick={() => setSelected([])}
            >
              Clear
            </button>
          )}
        </div>
        <button
          className={`run-correlation-top ${isAnalyzing ? 'working' : ''}`}
          disabled={selected.length < 2 || isAnalyzing}
          onClick={handleAnalyze}
        >
          {isAnalyzing ? (
            <><span className="btn-spinner" /> Analyzing...</>
          ) : (
            `Analyze Selected (${selected.length})`
          )}
        </button>
      </div>

      {/* Past Analyses Widget - Always visible */}
      <div className="past-analyses-widget">
        <div className="past-analyses-header">
          <h3>Past Analyses</h3>
          {analysisHistory.length > 0 && (
            <button
              className="view-all-history-btn"
              onClick={() => setViewMode('history')}
            >
              View All ({analysisHistory.length})
            </button>
          )}
        </div>
        {analysisHistory.length === 0 ? (
          <div className="no-history-message">
            No analyses yet. Select articles and click "Analyze" to create your first cross-regional analysis.
          </div>
        ) : (
          <div className="past-analyses-list">
            {analysisHistory.slice(0, 4).map(result => (
              <button
                key={result.id}
                className="past-analysis-card"
                onClick={() => { onViewResult?.(result); setViewMode('result') }}
              >
                <div className="past-analysis-flags">
                  {Object.keys(result.perspectivesByCountry).slice(0, 4).map(countryCode => {
                    const country = getCountryByCode(countryCode)
                    return <span key={countryCode} className="flag-mini">{country?.flag}</span>
                  })}
                  {Object.keys(result.perspectivesByCountry).length > 4 && (
                    <span className="flag-more">+{Object.keys(result.perspectivesByCountry).length - 4}</span>
                  )}
                </div>
                <div className="past-analysis-topic">{result.topic}</div>
                <div className="past-analysis-meta">
                  <span>{result.articles.length} articles</span>
                  <span>{new Date(result.timestamp).toLocaleDateString()}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Suggested Analyses */}
      {suggestedAnalyses.length > 0 && (
        <div className="suggested-analyses">
          <h3>Suggested Analyses</h3>
          <div className="suggestions-list">
            {suggestedAnalyses.map((suggestion, i) => (
              <div key={i} className="suggestion-card">
                <div className="suggestion-countries">
                  {suggestion.countries.map(c => {
                    const country = getCountryByCode(c)
                    return <span key={c} className="country-flag" title={country?.name}>{country?.flag}</span>
                  })}
                </div>
                <div className="suggestion-title">{suggestion.title}</div>
                <div className="suggestion-desc">{suggestion.description}</div>
                <button
                  onClick={() => setSelected(suggestion.articleIds)}
                  className="select-suggestion"
                >
                  Select for Analysis
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="all-articles-header">
        <h3>All Articles ({filteredArticles.length})</h3>
        {(searchQuery || selectedSource) && (
          <div className="selection-actions">
            {searchQuery && (
              <span className="search-results-info">Showing results for "{searchQuery}"</span>
            )}
            {selectedSource && (
              <span className="search-results-info">Filtered by source: {selectedSource}</span>
            )}
            {filteredArticles.length > 0 && (
              <button
                className="select-all-btn"
                onClick={() => {
                  const matchingIds = filteredArticles.map(a => a.id)
                  setSelected(matchingIds)
                }}
                title={`Select all ${filteredArticles.length} matching articles`}
              >
                Select All Matching
              </button>
            )}
          </div>
        )}
      </div>

      <div className="correlation-selector">
        {filteredArticles.map(article => {
          const country = getCountryByCode(article.country)
          const orient = orientationLabels[article.orientation]
          const sourceTrust = getSourceTrust(article.source)
          const trustLevel = sourceTrust ? trustLevelLabels[sourceTrust.factCheckRecord] : null
          const topicInfo = topics.find(t => t.id === article.topic)

          return (
            <label
              key={article.id}
              className={`correlation-article ${selected.includes(article.id) ? 'selected' : ''} ${article.fakeNewsScore && article.fakeNewsScore > 50 ? 'misinfo-risk' : ''}`}
              onClick={() => toggle(article.id)}
            >
              <input type="checkbox" checked={selected.includes(article.id)} onChange={() => {}} />
              {/* Thumbnail */}
              {article.imageUrl && (
                <div className="correlation-thumb">
                  <img src={article.imageUrl} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                </div>
              )}
              <div className="info">
                <div className="article-header-row">
                  <span className="flag">{country?.flag}</span>
                  <span className="source">{article.source}</span>
                  {trustLevel && (
                    <span className="trust-badge" style={{ background: trustLevel.color }}>
                      {sourceTrust?.trustworthiness}%
                    </span>
                  )}
                  <span className="orient-badge" style={{ color: orient.color }}>
                    {orient.short}
                  </span>
                  <span className="lang-badge" title={`Original: ${languageNames[article.originalLanguage] || article.originalLanguage}`}>
                    {article.originalLanguage.toUpperCase()}
                  </span>
                  {article.translatedContent && (
                    <span className="translated-mini" title={`Translated to ${languageNames[article.targetLanguage || 'en']}`}>
                      🌐
                    </span>
                  )}
                </div>
                <div className="title">{article.title}</div>

                {/* Prominent Fake News Warning */}
                {article.fakeNewsScore !== undefined && article.fakeNewsScore > 30 && (
                  <div className={`fake-news-alert-mini ${article.fakeNewsScore > 70 ? 'critical' : article.fakeNewsScore > 50 ? 'high' : 'moderate'}`}>
                    ⚠️ Misinfo Risk: {article.fakeNewsScore}%
                  </div>
                )}

                <div className="meta-row">
                  {topicInfo && (
                    <span className="topic-mini">{topicInfo.icon} {topicInfo.label}</span>
                  )}
                  <span className="date">{new Date(article.publishedAt).toLocaleDateString()}</span>
                  {article.isTrending && <span className="trending-mini">🔥</span>}
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="article-link-mini"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Original ↗
                  </a>
                </div>
                {article.biasAnalysis && (
                  <div className="bias-summary">
                    Bias: {article.biasAnalysis.score > 0.3 ? 'Right' : article.biasAnalysis.score < -0.3 ? 'Left' : 'Center'}
                    {' - '}{article.biasAnalysis.explanation.substring(0, 100)}...
                  </div>
                )}
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}

// Logs View with comprehensive cost tracking
function LogsView() {
  const [requests, setRequests] = useState<ClaudeRequest[]>([])
  const [responses, setResponses] = useState<ClaudeResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadHistory() {
      setIsLoading(true)
      try {
        const history = await getClaudeHistory()
        setRequests(history.requests.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()))
        setResponses(history.responses)
      } catch (err) {
        console.error('Failed to load Claude history:', err)
      }
      setIsLoading(false)
    }
    loadHistory()
  }, [])

  // Calculate totals
  const totals = useMemo(() => {
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let totalCost = 0
    const costByOperation: Record<string, { count: number; cost: number; inputTokens: number; outputTokens: number }> = {}

    for (const resp of responses) {
      totalInputTokens += resp.inputTokens || 0
      totalOutputTokens += resp.outputTokens || 0
      totalCost += resp.costUSD || 0

      const op = resp.operation || 'unknown'
      if (!costByOperation[op]) {
        costByOperation[op] = { count: 0, cost: 0, inputTokens: 0, outputTokens: 0 }
      }
      costByOperation[op].count++
      costByOperation[op].cost += resp.costUSD || 0
      costByOperation[op].inputTokens += resp.inputTokens || 0
      costByOperation[op].outputTokens += resp.outputTokens || 0
    }

    return { totalInputTokens, totalOutputTokens, totalCost, costByOperation }
  }, [responses])

  // Map responses to requests for display
  const logsWithDetails = useMemo(() => {
    return requests.map(req => {
      const resp = responses.find(r => r.requestId === req.id)
      return { request: req, response: resp }
    })
  }, [requests, responses])

  const operationLabels: Record<string, string> = {
    'translate': '🌐 Translation',
    'analyze_bias': '⚖️ Bias Analysis',
    'assess_trust': '🛡️ Trust Assessment',
    'detect_fake_news': '🔍 Fake News Detection',
    'cross_regional_analysis': '🌍 Cross-Regional Analysis',
    'summarize': '📝 Summarize',
    'unknown': '❓ Other'
  }

  const formatCost = (cost: number) => {
    if (cost < 0.01) return `$${cost.toFixed(6)}`
    if (cost < 1) return `$${cost.toFixed(4)}`
    return `$${cost.toFixed(2)}`
  }

  return (
    <div className="logs-page">
      <h2>API Transparency Log</h2>
      <p className="logs-description">Complete transparency into all Claude API calls, token usage, and costs.</p>

      {isLoading ? (
        <div className="logs-loading">
          <span className="spinner" />
          Loading API history...
        </div>
      ) : responses.length === 0 ? (
        <div className="logs-empty">
          <p>No API calls yet</p>
          <p className="logs-hint">Translate articles, analyze bias, or run cross-regional analysis to see API usage.</p>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="logs-summary">
            <div className="summary-card total-cost">
              <div className="summary-label">Total Spent</div>
              <div className="summary-value">{formatCost(totals.totalCost)}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">API Calls</div>
              <div className="summary-value">{responses.length}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Input Tokens</div>
              <div className="summary-value">{totals.totalInputTokens.toLocaleString()}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Output Tokens</div>
              <div className="summary-value">{totals.totalOutputTokens.toLocaleString()}</div>
            </div>
          </div>

          {/* Cost by Operation */}
          <div className="logs-by-operation">
            <h3>Cost by Operation</h3>
            <div className="operation-breakdown">
              {Object.entries(totals.costByOperation)
                .sort((a, b) => b[1].cost - a[1].cost)
                .map(([op, data]) => (
                  <div key={op} className="operation-row">
                    <span className="operation-name">{operationLabels[op] || op}</span>
                    <span className="operation-count">{data.count} calls</span>
                    <span className="operation-tokens">
                      {data.inputTokens.toLocaleString()} in / {data.outputTokens.toLocaleString()} out
                    </span>
                    <span className="operation-cost">{formatCost(data.cost)}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Individual Calls */}
          <div className="logs-list">
            <h3>Recent API Calls</h3>
            {logsWithDetails.slice(0, 50).map(({ request, response }) => (
              <div key={request.id} className="log-entry">
                <div className="log-header">
                  <span className="log-operation">
                    {operationLabels[response?.operation || 'unknown'] || response?.operation || 'Unknown'}
                  </span>
                  <span className="log-timestamp">
                    {new Date(request.timestamp).toLocaleString()}
                  </span>
                  {response && (
                    <span className="log-cost">{formatCost(response.costUSD || 0)}</span>
                  )}
                </div>
                <div className="log-details">
                  <div className="log-prompt">
                    <strong>Prompt:</strong>
                    <span className="prompt-preview">
                      {request.prompt.substring(0, 200)}
                      {request.prompt.length > 200 ? '...' : ''}
                    </span>
                  </div>
                  {response && (
                    <div className="log-tokens">
                      <span className="token-badge input">
                        ↓ {response.inputTokens?.toLocaleString() || 0} input
                      </span>
                      <span className="token-badge output">
                        ↑ {response.outputTokens?.toLocaleString() || 0} output
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Settings View
function SettingsView({
  preferences,
  onUpdate,
  onLogout,
  onManageCountries,
  selectedCountries,
  authHook
}: {
  preferences: any
  onUpdate: (updates: any) => void
  onLogout: () => void
  onManageCountries: () => void
  selectedCountries: string[]
  authHook: ReturnType<typeof useAuth>
}) {
  const [showCredentialsModal, setShowCredentialsModal] = useState(false)

  return (
    <div className="settings-page">
      <h2>Settings</h2>

      {/* Display Preferences */}
      <div className="settings-section">
        <h3>Display Preferences</h3>
        <div className="setting-row">
          <label>Default Display Language</label>
          <select
            value={preferences.targetLanguage || 'en'}
            onChange={e => onUpdate({ targetLanguage: e.target.value })}
          >
            {Object.entries(languageNames).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </div>
        <p className="setting-hint">
          Articles in other languages will be shown translated to this language by default.
        </p>
      </div>

      {/* Cost Control - Automatic Features */}
      <div className="settings-section">
        <h3>💰 Cost Control - Automatic Features</h3>
        <p className="section-description">
          Disable automatic features to reduce API costs. You can still run these manually on individual articles.
        </p>

        <div className="setting-row toggle-row">
          <div className="setting-info">
            <label>Auto-translate on fetch</label>
            <span className="setting-cost">~$0.01 per article</span>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={preferences.autoTranslateOnFetch ?? false}
              onChange={e => onUpdate({ autoTranslateOnFetch: e.target.checked })}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="setting-row toggle-row">
          <div className="setting-info">
            <label>Auto-analyze bias</label>
            <span className="setting-cost">~$0.02 per article</span>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={preferences.autoAnalyzeBias ?? false}
              onChange={e => onUpdate({ autoAnalyzeBias: e.target.checked })}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="setting-row toggle-row">
          <div className="setting-info">
            <label>Auto-assess trust</label>
            <span className="setting-cost">~$0.01 per article</span>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={preferences.autoAssessTrust ?? false}
              onChange={e => onUpdate({ autoAssessTrust: e.target.checked })}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="setting-row toggle-row">
          <div className="setting-info">
            <label>Auto-detect fake news</label>
            <span className="setting-cost">~$0.02 per article</span>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={preferences.autoDetectFakeNews ?? false}
              onChange={e => onUpdate({ autoDetectFakeNews: e.target.checked })}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="setting-row toggle-row">
          <div className="setting-info">
            <label>Auto-analyze images</label>
            <span className="setting-cost">~$0.01 per image</span>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={preferences.autoAnalyzeImages ?? false}
              onChange={e => onUpdate({ autoAnalyzeImages: e.target.checked })}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

      {/* Country Management */}
      <div className="settings-section">
        <h3>🌍 Countries & Sources</h3>
        <div className="country-summary">
          <span>Currently monitoring {selectedCountries.length} countries:</span>
          <div className="country-flags">
            {selectedCountries.slice(0, 10).map(code => {
              const country = getCountryByCode(code)
              return country ? (
                <span key={code} className="country-flag-mini" title={country.name}>
                  {country.flag}
                </span>
              ) : null
            })}
            {selectedCountries.length > 10 && (
              <span className="more-countries">+{selectedCountries.length - 10} more</span>
            )}
          </div>
        </div>
        <button className="settings-btn" onClick={onManageCountries}>
          Manage Countries & Sources
        </button>
      </div>

      {/* API Credentials */}
      <div className="settings-section">
        <h3>🔑 API Credentials</h3>
        <p className="section-description">
          Update your Anthropic API key. You'll need to provide your passphrase to make changes.
        </p>
        <button className="settings-btn" onClick={() => setShowCredentialsModal(true)}>
          Edit API Credentials
        </button>
      </div>

      {/* Account */}
      <div className="settings-section">
        <h3>Account</h3>
        <button className="danger-btn" onClick={onLogout}>
          Logout & Clear All Data
        </button>
      </div>

      {/* Credentials Modal */}
      {showCredentialsModal && (
        <CredentialsModal
          onClose={() => setShowCredentialsModal(false)}
          onSave={() => {
            setShowCredentialsModal(false)
          }}
          authHook={authHook}
        />
      )}
    </div>
  )
}

// Credentials Edit Modal
function CredentialsModal({
  onClose,
  onSave,
  authHook
}: {
  onClose: () => void
  onSave: (apiKey: string, passphrase: string) => void
  authHook: ReturnType<typeof useAuth>
}) {
  const [passphrase, setPassphrase] = useState('')
  const [newApiKey, setNewApiKey] = useState('')
  const [step, setStep] = useState<'verify' | 'edit'>('verify')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleVerify = async () => {
    setIsLoading(true)
    setError('')
    // Verify passphrase
    const isValid = await authHook.verifyPassphrase(passphrase)
    if (isValid) {
      setStep('edit')
      setError('')
    } else {
      setError('Invalid passphrase')
    }
    setIsLoading(false)
  }

  const handleSave = async () => {
    if (newApiKey.length < 10) {
      setError('Please enter a valid API key')
      return
    }
    setIsLoading(true)
    setError('')
    const success = await authHook.updateApiKey(newApiKey, passphrase)
    if (success) {
      onSave(newApiKey, passphrase)
    } else {
      setError(authHook.error || 'Failed to update API key')
    }
    setIsLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal credentials-modal" onClick={e => e.stopPropagation()}>
        <h3>Edit API Credentials</h3>

        {step === 'verify' ? (
          <>
            <p>Enter your passphrase to continue:</p>
            <div className="form-group">
              <label>Passphrase</label>
              <input
                type="password"
                value={passphrase}
                onChange={e => setPassphrase(e.target.value)}
                placeholder="Enter your passphrase"
                onKeyDown={e => e.key === 'Enter' && handleVerify()}
              />
            </div>
            {error && <div className="modal-error">{error}</div>}
            <div className="modal-actions">
              <button onClick={onClose} disabled={isLoading}>Cancel</button>
              <button className="primary" onClick={handleVerify} disabled={isLoading}>
                {isLoading ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p>Enter your new API key:</p>
            <div className="form-group">
              <label>New Anthropic API Key</label>
              <input
                type="password"
                value={newApiKey}
                onChange={e => setNewApiKey(e.target.value)}
                placeholder="sk-ant-..."
              />
              <small>Get your key at console.anthropic.com</small>
            </div>
            {error && <div className="modal-error">{error}</div>}
            <div className="modal-actions">
              <button onClick={onClose} disabled={isLoading}>Cancel</button>
              <button className="primary" onClick={handleSave} disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save New Key'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Group Modal for manually adding articles to groups
function GroupModal({
  articleId,
  articleTitle,
  existingClusters,
  onAddToGroup,
  onCreateGroup,
  onClose
}: {
  articleId: string
  articleTitle: string
  existingClusters: ArticleCluster[]
  onAddToGroup: (clusterId: string) => void
  onCreateGroup: (groupName: string) => void
  onClose: () => void
}) {
  const [newGroupName, setNewGroupName] = useState('')
  const [mode, setMode] = useState<'select' | 'create'>(existingClusters.length > 0 ? 'select' : 'create')

  const handleCreateGroup = () => {
    if (newGroupName.trim()) {
      onCreateGroup(newGroupName.trim())
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal group-modal" onClick={e => e.stopPropagation()}>
        <h3>Add to Group</h3>
        <p className="modal-article-title">"{articleTitle.substring(0, 60)}..."</p>

        {existingClusters.length > 0 && (
          <div className="group-mode-tabs">
            <button
              className={mode === 'select' ? 'active' : ''}
              onClick={() => setMode('select')}
            >
              Existing Group
            </button>
            <button
              className={mode === 'create' ? 'active' : ''}
              onClick={() => setMode('create')}
            >
              New Group
            </button>
          </div>
        )}

        {mode === 'select' && existingClusters.length > 0 && (
          <div className="existing-groups">
            {existingClusters.map(cluster => (
              <button
                key={cluster.id}
                className="group-option"
                onClick={() => onAddToGroup(cluster.id)}
              >
                <span className="group-name">{cluster.name}</span>
                <span className="group-count">{cluster.articleIds.length} articles</span>
              </button>
            ))}
          </div>
        )}

        {mode === 'create' && (
          <div className="create-group">
            <div className="form-group">
              <label>Group Name</label>
              <input
                type="text"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                placeholder="e.g., Ukraine Conflict, Tech Layoffs..."
                onKeyDown={e => e.key === 'Enter' && handleCreateGroup()}
                autoFocus
              />
            </div>
            <button
              className="primary create-group-btn"
              onClick={handleCreateGroup}
              disabled={!newGroupName.trim()}
            >
              Create Group & Add Article
            </button>
          </div>
        )}

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// Merge Cluster Modal
function MergeModal({
  sourceClusterId,
  sourceClusterName,
  availableClusters,
  onMerge,
  onClose
}: {
  sourceClusterId: string
  sourceClusterName: string
  availableClusters: Array<{ id: string; name: string; articleCount: number }>
  onMerge: (targetClusterId: string, newName?: string) => void
  onClose: () => void
}) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [useCustomName, setUseCustomName] = useState(false)

  const selectedTargetCluster = availableClusters.find(c => c.id === selectedTarget)

  const handleMerge = () => {
    if (selectedTarget) {
      onMerge(selectedTarget, useCustomName && newName.trim() ? newName.trim() : undefined)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal merge-modal" onClick={e => e.stopPropagation()}>
        <h3>Merge Groups</h3>
        <p className="merge-source">
          Merging: <strong>"{sourceClusterName}"</strong>
        </p>

        {availableClusters.length === 0 ? (
          <div className="no-clusters-message">
            <p>No other groups available to merge with.</p>
            <p className="hint">Create more article groups first, then you can merge them.</p>
          </div>
        ) : (
          <>
            <p className="merge-instruction">Select a group to merge into:</p>

            <div className="merge-targets">
              {availableClusters.map(cluster => (
                <button
                  key={cluster.id}
                  className={`merge-target ${selectedTarget === cluster.id ? 'selected' : ''}`}
                  onClick={() => setSelectedTarget(cluster.id)}
                >
                  <span className="target-name">{cluster.name}</span>
                  <span className="target-count">{cluster.articleCount} articles</span>
                </button>
              ))}
            </div>

            {selectedTarget && (
              <div className="merge-options">
                <label className="custom-name-toggle">
                  <input
                    type="checkbox"
                    checked={useCustomName}
                    onChange={e => setUseCustomName(e.target.checked)}
                  />
                  <span>Use custom name for merged group</span>
                </label>

                {useCustomName && (
                  <div className="form-group">
                    <label>New Group Name</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      placeholder={selectedTargetCluster?.name || 'Enter group name...'}
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          {availableClusters.length > 0 && (
            <button
              className="primary"
              onClick={handleMerge}
              disabled={!selectedTarget}
            >
              Merge Groups
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Setup Wizard
function SetupWizard({
  selectedCountries,
  onToggleCountry,
  onClose,
  step,
  setStep
}: {
  selectedCountries: string[]
  onToggleCountry: (code: string) => void
  onClose: () => void
  step: number
  setStep: (s: number) => void
}) {
  return (
    <div className="wizard-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="wizard">
        <div className="wizard-header">
          <h2>Configure News Sources</h2>
          <p>Select the countries you want to monitor</p>
        </div>

        <div className="wizard-steps">
          <span className={`wizard-step ${step === 0 ? 'active' : step > 0 ? 'completed' : ''}`}>
            1. Select Countries
          </span>
          <span className={`wizard-step ${step === 1 ? 'active' : ''}`}>
            2. Done
          </span>
        </div>

        <div className="wizard-content">
          {step === 0 && (
            <div className="country-grid">
              {countries.map(country => (
                <button
                  key={country.code}
                  className={`country-option ${selectedCountries.includes(country.code) ? 'selected' : ''}`}
                  onClick={() => onToggleCountry(country.code)}
                >
                  <span className="flag">{country.flag}</span>
                  <span className="name">{country.name}</span>
                  {selectedCountries.includes(country.code) && <span className="check">✓</span>}
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <div style={{ textAlign: 'center', padding: '32px' }}>
              <h3 style={{ marginBottom: '8px', fontWeight: 'normal' }}>
                You selected {selectedCountries.length} countries
              </h3>
              <p style={{ color: '#666' }}>
                Click "Refresh Sources" to fetch news from your selected sources.
              </p>
            </div>
          )}
        </div>

        <div className="wizard-footer">
          <button onClick={onClose}>
            {step === 1 ? 'Close' : 'Cancel'}
          </button>
          {step === 0 && (
            <button
              className="primary"
              onClick={() => setStep(1)}
              disabled={selectedCountries.length === 0}
            >
              Continue
            </button>
          )}
          {step === 1 && (
            <button className="primary" onClick={onClose}>
              Start Using LibreNews
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
