// Coverage Timeline Graph Component - Interactive time-based article visualization
import { useState, useMemo, useRef, useEffect } from 'react'
import { Article } from '../lib/db'
import { generateTimelineData, TimelineDataPoint } from '../lib/coverage'

interface CoverageTimelineProps {
  articles: Article[]
  onDateRangeSelect: (startDate: Date | null, endDate: Date | null) => void
  selectedStartDate: Date | null
  selectedEndDate: Date | null
  searchQuery?: string
  onSearchChange?: (query: string) => void
}

export function CoverageTimeline({
  articles,
  onDateRangeSelect,
  selectedStartDate,
  selectedEndDate,
  searchQuery = '',
  onSearchChange
}: CoverageTimelineProps) {
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('day')
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const timelineData = useMemo(() => {
    return generateTimelineData(articles, granularity)
  }, [articles, granularity])

  const maxCount = useMemo(() => {
    return Math.max(...timelineData.map(d => d.count), 1)
  }, [timelineData])

  // Date range stats
  const dateStats = useMemo(() => {
    if (articles.length === 0) return null
    const dates = articles.map(a => new Date(a.publishedAt))
    const oldest = new Date(Math.min(...dates.map(d => d.getTime())))
    const newest = new Date(Math.max(...dates.map(d => d.getTime())))
    const spanDays = Math.ceil((newest.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24))
    return { oldest, newest, spanDays, total: articles.length }
  }, [articles])

  const handleBarClick = (dataPoint: TimelineDataPoint) => {
    const clickedDate = new Date(dataPoint.date)

    if (selectedStartDate && selectedEndDate) {
      // Clear selection if clicking again
      onDateRangeSelect(null, null)
    } else if (selectedStartDate && !selectedEndDate) {
      // Set end date
      if (clickedDate < selectedStartDate) {
        onDateRangeSelect(clickedDate, selectedStartDate)
      } else {
        onDateRangeSelect(selectedStartDate, clickedDate)
      }
    } else {
      // Set start date
      onDateRangeSelect(clickedDate, null)
    }
  }

  const handleMouseDown = (dataPoint: TimelineDataPoint) => {
    setIsDragging(true)
    setDragStart(dataPoint.date)
    onDateRangeSelect(new Date(dataPoint.date), null)
  }

  const handleMouseMove = (dataPoint: TimelineDataPoint) => {
    if (isDragging && dragStart) {
      const startDate = new Date(dragStart)
      const currentDate = new Date(dataPoint.date)
      if (currentDate < startDate) {
        onDateRangeSelect(currentDate, startDate)
      } else {
        onDateRangeSelect(startDate, currentDate)
      }
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setDragStart(null)
  }

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false)
      setDragStart(null)
    }
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [])

  const clearSelection = () => {
    onDateRangeSelect(null, null)
  }

  const isDateInRange = (dateStr: string) => {
    if (!selectedStartDate) return false
    const date = new Date(dateStr)
    if (!selectedEndDate) {
      return date.toDateString() === selectedStartDate.toDateString()
    }
    return date >= selectedStartDate && date <= selectedEndDate
  }

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr)
    if (granularity === 'month') {
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    }
    if (granularity === 'week') {
      return `W${getWeekNumber(date)}`
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className={`coverage-timeline ${isCollapsed ? 'collapsed' : ''}`} ref={containerRef}>
      <div className="timeline-header">
        <div className="timeline-title">
          <button
            className="collapse-toggle"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand timeline' : 'Collapse timeline'}
          >
            {isCollapsed ? '▶' : '▼'}
          </button>
          <h3>Coverage Timeline</h3>
          {dateStats && (
            <span
              className="timeline-stats"
              title={`Total ${dateStats.total} articles fetched, spanning from ${dateStats.oldest.toLocaleDateString()} to ${dateStats.newest.toLocaleDateString()}`}
            >
              {dateStats.total} articles over {dateStats.spanDays} days
            </span>
          )}
        </div>

        {!isCollapsed && (
          <div className="timeline-controls">
            <div className="timeline-search">
              <input
                type="text"
                placeholder="Filter by keyword..."
                value={searchQuery}
                onChange={(e) => onSearchChange?.(e.target.value)}
              />
              {searchQuery && (
                <button className="clear-search" onClick={() => onSearchChange?.('')}>
                  ×
                </button>
              )}
            </div>

            <div className="granularity-selector">
              <button
                className={granularity === 'day' ? 'active' : ''}
                onClick={() => setGranularity('day')}
              >
                Day
              </button>
              <button
                className={granularity === 'week' ? 'active' : ''}
                onClick={() => setGranularity('week')}
              >
                Week
              </button>
              <button
                className={granularity === 'month' ? 'active' : ''}
                onClick={() => setGranularity('month')}
              >
                Month
              </button>
            </div>

            {(selectedStartDate || selectedEndDate) && (
              <button className="clear-date-range" onClick={clearSelection}>
                Clear Selection
              </button>
            )}
          </div>
        )}
      </div>

      {!isCollapsed && (
        <>
          {(selectedStartDate || selectedEndDate) && (
            <div className="date-range-indicator">
              <span>
                {selectedStartDate?.toLocaleDateString()}
                {selectedEndDate && ` - ${selectedEndDate.toLocaleDateString()}`}
              </span>
              <span className="filtered-count">
                {articles.filter(a => {
                  const d = new Date(a.publishedAt)
                  if (!selectedStartDate) return true
                  if (!selectedEndDate) return d.toDateString() === selectedStartDate.toDateString()
                  return d >= selectedStartDate && d <= selectedEndDate
                }).length} articles selected
              </span>
            </div>
          )}

          <div className="timeline-graph" onMouseUp={handleMouseUp}>
            <div className="graph-bars">
              {timelineData.map((dataPoint, idx) => {
                const height = (dataPoint.count / maxCount) * 100
                const isSelected = isDateInRange(dataPoint.date)

                return (
                  <div
                    key={dataPoint.date}
                    className={`graph-bar-container ${isSelected ? 'selected' : ''}`}
                    onMouseDown={() => handleMouseDown(dataPoint)}
                    onMouseMove={() => handleMouseMove(dataPoint)}
                    onClick={() => !isDragging && handleBarClick(dataPoint)}
                  >
                    <div
                    className="graph-bar-stack"
                    style={{ height: `${height}%` }}
                    title={`${formatDateLabel(dataPoint.date)}: ${dataPoint.count} article${dataPoint.count !== 1 ? 's' : ''} (Left: ${dataPoint.leftCount}, Center: ${dataPoint.centerCount}, Right: ${dataPoint.rightCount}${dataPoint.stateCount > 0 ? `, State: ${dataPoint.stateCount}` : ''}). Click to filter.`}
                  >
                      {dataPoint.leftCount > 0 && (
                        <div
                          className="bar-segment left"
                          style={{ flex: dataPoint.leftCount }}
                          title={`Left-leaning sources: ${dataPoint.leftCount} article${dataPoint.leftCount !== 1 ? 's' : ''}`}
                        />
                      )}
                      {dataPoint.centerCount > 0 && (
                        <div
                          className="bar-segment center"
                          style={{ flex: dataPoint.centerCount }}
                          title={`Centrist sources: ${dataPoint.centerCount} article${dataPoint.centerCount !== 1 ? 's' : ''}`}
                        />
                      )}
                      {dataPoint.rightCount > 0 && (
                        <div
                          className="bar-segment right"
                          style={{ flex: dataPoint.rightCount }}
                          title={`Right-leaning sources: ${dataPoint.rightCount} article${dataPoint.rightCount !== 1 ? 's' : ''}`}
                        />
                      )}
                      {dataPoint.stateCount > 0 && (
                        <div
                          className="bar-segment state"
                          style={{ flex: dataPoint.stateCount }}
                          title={`State-affiliated sources: ${dataPoint.stateCount} article${dataPoint.stateCount !== 1 ? 's' : ''}`}
                        />
                      )}
                    </div>
                    <div className="bar-count">{dataPoint.count}</div>
                    {idx % Math.max(1, Math.floor(timelineData.length / 10)) === 0 && (
                      <div className="bar-label">{formatDateLabel(dataPoint.date)}</div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="graph-legend">
              <span className="legend-item left" title="Left-leaning/progressive editorial stance">Left</span>
              <span className="legend-item center" title="Centrist/balanced editorial stance">Center</span>
              <span className="legend-item right" title="Right-leaning/conservative editorial stance">Right</span>
              <span className="legend-item state" title="State-controlled or government-affiliated media">State</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Helper function to get week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
