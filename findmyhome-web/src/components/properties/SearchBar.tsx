'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, MapPin, X } from 'lucide-react'
import { AREAS } from '@/lib/utils'

const RENT_PRESETS = ['200,000', '350,000', '500,000', '800,000', '1,200,000', '2,000,000']
const BUY_PRESETS  = [
  { label: 'Any Price',    value: '' },
  { label: 'Under 50M',   value: '0-50000000' },
  { label: '50M – 150M',  value: '50000000-150000000' },
  { label: '150M – 300M', value: '150000000-300000000' },
  { label: '300M+',       value: '300000000-' },
]

interface SearchBarProps {
  defaultLocation?: string
  defaultListing?: string
  defaultPrice?: string
  onSearch?: (params: Record<string, string>) => void
  compact?: boolean
}

export function SearchBar({ defaultLocation = '', defaultListing = 'sale', defaultPrice = '', onSearch, compact = false }: SearchBarProps) {
  const [listing,     setListing]     = useState(defaultListing)
  const [location,    setLocation]    = useState(defaultLocation)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [priceInput,  setPriceInput]  = useState(defaultPrice)
  const [pricePreset, setPricePreset] = useState('')
  const [showPrice,   setShowPrice]   = useState(false)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const isRent     = listing === 'rent'
  const suggestions = location.trim() === ''
    ? AREAS
    : AREAS.filter(a => a.toLowerCase().includes(location.toLowerCase()))

  const handleSearch = () => {
    const params = new URLSearchParams()
    if (location)    params.set('location', location)
    if (listing)     params.set('listing',  listing)
    if (isRent && priceInput) {
      params.set('max_price', priceInput.replace(/,/g, ''))
    } else if (!isRent && pricePreset) {
      const [min, max] = pricePreset.split('-')
      if (min) params.set('min_price', min)
      if (max) params.set('max_price', max)
    }
    if (onSearch) {
      onSearch(Object.fromEntries(params))
    } else {
      router.push(`/search?${params.toString()}`)
    }
  }

  return (
    <div className={`bg-white rounded-2xl border border-sand overflow-visible shadow-modal ${compact ? '' : ''}`}>
      {/* Listing type tabs */}
      <div className="flex border-b border-sand">
        {['sale', 'rent', 'land'].map(t => (
          <button key={t} onClick={() => { setListing(t); setPriceInput(''); setPricePreset('') }}
            className={`flex-1 py-3.5 text-sm font-medium capitalize transition-colors
              ${listing === t
                ? 'text-ink border-b-2 border-ink -mb-px'
                : 'text-stone hover:text-ink'}`}>
            {t === 'sale' ? 'Buy' : t === 'rent' ? 'Rent' : 'Land'}
          </button>
        ))}
      </div>

      <div className="p-4">
        {/* Location input */}
        <div className="mb-3 relative">
          <div className="text-[9px] font-bold uppercase tracking-[1.5px] text-dust mb-1.5">Location</div>
          <div className={`flex items-center gap-2.5 px-3.5 py-2.5 border rounded-lg bg-paper transition-colors
            ${showSuggestions ? 'border-ink' : 'border-sand'}`}>
            <MapPin className="w-3.5 h-3.5 text-dust flex-shrink-0" />
            <input
              ref={inputRef}
              value={location}
              onChange={e => setLocation(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Type any area in Uganda..."
              className="flex-1 border-none outline-none text-sm text-ink bg-transparent placeholder:text-dust"
            />
            {location && (
              <button onClick={() => setLocation('')}><X className="w-3.5 h-3.5 text-dust" /></button>
            )}
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-sand rounded-xl shadow-modal z-50 overflow-hidden">
              <div className="px-3.5 pt-2.5 pb-1 text-[9px] font-bold uppercase tracking-[1.5px] text-dust">
                {location ? 'Matching areas' : 'Popular areas'}
              </div>
              <div className="flex flex-wrap gap-1.5 px-3.5 pb-3">
                {suggestions.length > 0 ? suggestions.slice(0, 12).map(s => (
                  <button key={s} onMouseDown={() => { setLocation(s); setShowSuggestions(false) }}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-all
                      ${location === s ? 'bg-ink text-white border-ink' : 'bg-cream text-ink border-sand hover:border-ink'}`}>
                    {s}
                  </button>
                )) : (
                  <p className="text-xs text-dust italic py-1">No matching area — will search all Uganda</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Price filter */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[9px] font-bold uppercase tracking-[1.5px] text-dust">
              {isRent ? 'Max Monthly Rent (UGX)' : 'Budget (UGX)'}
            </div>
            <span className="text-[9px] text-dust italic">Optional</span>
          </div>

          {isRent ? (
            <>
              <div className={`flex items-center gap-2 px-3.5 py-2.5 border rounded-lg bg-paper mb-2 transition-colors
                ${priceInput ? 'border-ink' : 'border-sand'}`}>
                <span className="text-xs text-stone">UGX</span>
                <input type="number" value={priceInput} onChange={e => setPriceInput(e.target.value)}
                  placeholder="Enter maximum rent..."
                  className="flex-1 border-none outline-none text-sm text-ink bg-transparent placeholder:text-dust" />
                {priceInput && <button onClick={() => setPriceInput('')}><X className="w-3.5 h-3.5 text-dust" /></button>}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {RENT_PRESETS.map(p => {
                  const v = p.replace(/,/g, '')
                  return (
                    <button key={p} onClick={() => setPriceInput(priceInput === v ? '' : v)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-all
                        ${priceInput === v ? 'bg-forest text-white border-forest' : 'bg-white text-stone border-sand hover:border-stone'}`}>
                      {p}
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="flex gap-1.5 flex-wrap">
              {BUY_PRESETS.map(p => (
                <button key={p.label} onClick={() => setPricePreset(pricePreset === p.value && p.value !== '' ? '' : p.value)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-all
                    ${pricePreset === p.value && p.value !== '' ? 'bg-ink text-white border-ink' : 'bg-white text-stone border-sand hover:border-stone'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search button */}
        <button onClick={handleSearch}
          className="w-full py-3 bg-gold text-white text-sm font-semibold rounded-lg
                     hover:bg-gold-2 transition-all shadow-gold flex items-center justify-center gap-2">
          <Search className="w-4 h-4" />
          Search Properties
        </button>
      </div>
    </div>
  )
}
