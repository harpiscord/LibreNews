import { useState, useEffect } from 'react'
import { getClaudeHistory, ClaudeRequest, ClaudeResponse } from '../lib/db'

export function ApiLogViewer() {
  const [requests, setRequests] = useState<ClaudeRequest[]>([])
  const [responses, setResponses] = useState<ClaudeResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const history = await getClaudeHistory()
      setRequests(history.requests.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ))
      setResponses(history.responses)
      setIsLoading(false)
    }
    load()
  }, [])

  const getResponseForRequest = (requestId: string) => {
    return responses.find(r => r.requestId === requestId)
  }

  const totalTokens = responses.reduce((acc, r) => acc + r.inputTokens + r.outputTokens, 0)

  if (isLoading) {
    return <div className="api-log-viewer">Loading...</div>
  }

  return (
    <div className="api-log-viewer">
      <h3>API Call Transparency Log</h3>
      <p className="stats">
        Total requests: {requests.length} | Total tokens used: {totalTokens.toLocaleString()}
      </p>

      <div className="log-list">
        {requests.length === 0 ? (
          <p className="empty-state">No API calls yet</p>
        ) : (
          requests.map(req => {
            const response = getResponseForRequest(req.id)
            const isExpanded = expandedId === req.id

            return (
              <div key={req.id} className="log-entry">
                <div className="log-header" onClick={() => setExpandedId(isExpanded ? null : req.id)}>
                  <span className="timestamp">{new Date(req.timestamp).toLocaleString()}</span>
                  <span className="model">{req.model}</span>
                  {response && (
                    <span className="tokens">
                      {response.inputTokens + response.outputTokens} tokens
                    </span>
                  )}
                  <span className="expand-icon">{isExpanded ? '−' : '+'}</span>
                </div>

                {isExpanded && (
                  <div className="log-details">
                    <div className="section">
                      <h5>Prompt</h5>
                      <pre>{req.prompt}</pre>
                    </div>
                    {response && (
                      <div className="section">
                        <h5>Response</h5>
                        <pre>{response.content}</pre>
                        <p className="token-breakdown">
                          Input: {response.inputTokens} | Output: {response.outputTokens}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
