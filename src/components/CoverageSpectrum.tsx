// Coverage Spectrum Bar Component - Shows political distribution of sources
import { CoverageSpectrum, BlindspotInfo } from '../lib/coverage'

interface CoverageSpectrumBarProps {
  spectrum: CoverageSpectrum
  blindspot?: BlindspotInfo
  compact?: boolean
  showLabels?: boolean
}

export function CoverageSpectrumBar({
  spectrum,
  blindspot,
  compact = false,
  showLabels = true
}: CoverageSpectrumBarProps) {
  const { left, center, right, state, total } = spectrum
  const independentTotal = left + center + right

  if (total === 0) return null

  // Calculate percentages for bar widths
  const leftPct = independentTotal > 0 ? (left / independentTotal) * 100 : 0
  const centerPct = independentTotal > 0 ? (center / independentTotal) * 100 : 0
  const rightPct = independentTotal > 0 ? (right / independentTotal) * 100 : 0

  return (
    <div className={`coverage-spectrum ${compact ? 'compact' : ''}`}>
      <div className="spectrum-bar" title="Political Spectrum: Shows the distribution of sources covering this story by political orientation. A balanced bar indicates diverse coverage; a lopsided bar indicates potential blindspots.">
        {left > 0 && (
          <div
            className="spectrum-segment left"
            style={{ width: `${leftPct}%` }}
            title={`Left-leaning: ${left} source${left !== 1 ? 's' : ''} (${Math.round(leftPct)}%) - Sources with progressive/liberal editorial stance`}
          >
            {!compact && leftPct > 15 && <span>{left}</span>}
          </div>
        )}
        {center > 0 && (
          <div
            className="spectrum-segment center"
            style={{ width: `${centerPct}%` }}
            title={`Center: ${center} source${center !== 1 ? 's' : ''} (${Math.round(centerPct)}%) - Sources with balanced/neutral editorial stance`}
          >
            {!compact && centerPct > 15 && <span>{center}</span>}
          </div>
        )}
        {right > 0 && (
          <div
            className="spectrum-segment right"
            style={{ width: `${rightPct}%` }}
            title={`Right-leaning: ${right} source${right !== 1 ? 's' : ''} (${Math.round(rightPct)}%) - Sources with conservative editorial stance`}
          >
            {!compact && rightPct > 15 && <span>{right}</span>}
          </div>
        )}
      </div>
      {showLabels && !compact && (
        <div className="spectrum-labels">
          <span className="label-left">L</span>
          <span className="label-center">C</span>
          <span className="label-right">R</span>
        </div>
      )}
      {state > 0 && (
        <div className="state-indicator" title={`${state} state-affiliated source${state !== 1 ? 's' : ''} - Government-controlled or heavily influenced media. Consider potential bias in favor of state narratives.`}>
          <span className="state-badge">STATE: {state}</span>
        </div>
      )}
    </div>
  )
}

interface BlindspotAlertProps {
  blindspot: BlindspotInfo
  compact?: boolean
}

export function BlindspotAlert({ blindspot, compact = false }: BlindspotAlertProps) {
  if (blindspot.type === 'balanced' || blindspot.severity === 'none') {
    return null
  }

  const getIcon = () => {
    switch (blindspot.severity) {
      case 'high': return '🚨'
      case 'medium': return '⚠️'
      case 'low': return '👁️'
      default: return '📊'
    }
  }

  const getTypeLabel = () => {
    switch (blindspot.type) {
      case 'left-blindspot': return 'LEFT BLINDSPOT'
      case 'right-blindspot': return 'RIGHT BLINDSPOT'
      case 'center-only': return 'CENTER ONLY'
      case 'state-only': return 'STATE MEDIA ONLY'
      default: return 'COVERAGE GAP'
    }
  }

  const getFullExplanation = () => {
    switch (blindspot.type) {
      case 'left-blindspot':
        return 'Left-leaning media is not covering this story. You may be missing progressive perspectives on this issue.'
      case 'right-blindspot':
        return 'Right-leaning media is not covering this story. You may be missing conservative perspectives on this issue.'
      case 'center-only':
        return 'Only centrist sources are covering this. You may be missing both progressive and conservative takes.'
      case 'state-only':
        return 'Only state-controlled media is covering this. Independent journalism perspectives are missing.'
      default:
        return blindspot.description
    }
  }

  return (
    <div
      className={`blindspot-alert ${blindspot.severity} ${blindspot.type} ${compact ? 'compact' : ''}`}
      title={getFullExplanation()}
    >
      <span className="blindspot-icon">{getIcon()}</span>
      <span className="blindspot-label">{getTypeLabel()}</span>
      {!compact && (
        <span className="blindspot-description">{blindspot.description}</span>
      )}
    </div>
  )
}

interface SourceCountBadgeProps {
  count: number
  countries?: number
}

export function SourceCountBadge({ count, countries }: SourceCountBadgeProps) {
  const tooltip = countries && countries > 1
    ? `${count} unique news sources from ${countries} different countries are covering this story. More sources = more comprehensive coverage.`
    : `${count} unique news source${count !== 1 ? 's are' : ' is'} covering this story.`

  return (
    <div className="source-count-badge" title={tooltip}>
      <span className="source-count">{count} source{count !== 1 ? 's' : ''}</span>
      {countries && countries > 1 && (
        <span className="country-count">{countries} countries</span>
      )}
    </div>
  )
}
