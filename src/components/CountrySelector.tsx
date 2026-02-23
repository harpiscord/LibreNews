import { countries, Country } from '../lib/countries'

interface CountrySelectorProps {
  selectedCountries: string[]
  onToggle: (code: string) => void
}

export function CountrySelector({ selectedCountries, onToggle }: CountrySelectorProps) {
  return (
    <div className="country-selector">
      <h3>Select Countries</h3>
      <div className="country-grid">
        {countries.map((country: Country) => (
          <button
            key={country.code}
            className={`country-btn ${selectedCountries.includes(country.code) ? 'selected' : ''}`}
            onClick={() => onToggle(country.code)}
          >
            <span className="flag">{country.flag}</span>
            <span className="name">{country.name}</span>
            <span className="count">{country.newspapers.length} sources</span>
          </button>
        ))}
      </div>
    </div>
  )
}
