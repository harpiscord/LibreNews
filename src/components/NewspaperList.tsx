import { getCountryByCode, Newspaper } from '../lib/countries'

interface NewspaperListProps {
  selectedCountries: string[]
  onSelectNewspaper: (newspaper: Newspaper, countryCode: string) => void
}

export function NewspaperList({ selectedCountries, onSelectNewspaper }: NewspaperListProps) {
  const getOrientationColor = (orientation: string) => {
    switch (orientation) {
      case 'left': return '#e74c3c'
      case 'center-left': return '#e67e22'
      case 'center': return '#95a5a6'
      case 'center-right': return '#3498db'
      case 'right': return '#2980b9'
      case 'state': return '#9b59b6'
      default: return '#95a5a6'
    }
  }

  return (
    <div className="newspaper-list">
      <h3>Available Sources</h3>
      {selectedCountries.length === 0 ? (
        <p className="empty-state">Select countries to see available newspapers</p>
      ) : (
        selectedCountries.map(code => {
          const country = getCountryByCode(code)
          if (!country) return null

          return (
            <div key={code} className="country-section">
              <h4>{country.flag} {country.name}</h4>
              <div className="newspaper-grid">
                {country.newspapers.map(paper => (
                  <button
                    key={paper.url}
                    className="newspaper-btn"
                    onClick={() => onSelectNewspaper(paper, code)}
                  >
                    <span className="paper-name">{paper.name}</span>
                    <span
                      className="orientation-badge"
                      style={{ backgroundColor: getOrientationColor(paper.orientation) }}
                    >
                      {paper.orientation}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
