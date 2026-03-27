'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { PropertyCard } from '@/components/properties/PropertyCard'
import { propertiesApi } from '@/lib/api'
import { AREAS } from '@/lib/utils'
import { SlidersHorizontal, X, Search, MapPin } from 'lucide-react'

const RENT_PRESETS  = ['200,000','350,000','500,000','800,000','1,200,000','2,000,000']
const BUY_PRESETS   = [{ l:'Any', v:'' },{ l:'<50M', v:'0-50000000' },{ l:'50–150M', v:'50000000-150000000' },{ l:'150–300M', v:'150000000-300000000' },{ l:'300M+', v:'300000000-' }]
const PROP_TYPES    = ['All','House','Airbnb','Lodge','Rental','Apartment','Land']
const LISTING_TYPES = ['All','Sale','Rent']

export default function SearchPage() {
  const params = useSearchParams()

  const [properties, setProperties]     = useState<any[]>([])
  const [loading,    setLoading]         = useState(true)
  const [page,       setPage]            = useState(1)
  const [total,      setTotal]           = useState(0)
  const [lastPage,   setLastPage]        = useState(1)

  // Filters
  const [location,    setLocation]    = useState(params.get('location') ?? '')
  const [locFocus,    setLocFocus]    = useState(false)
  const [listing,     setListing]     = useState(params.get('listing') ?? 'All')
  const [propType,    setPropType]    = useState(params.get('type') ?? 'All')
  const [priceInput,  setPriceInput]  = useState('')
  const [pricePreset, setPricePreset] = useState('')
  const [badgeOnly,   setBadgeOnly]   = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [sort,        setSort]        = useState('newest')

  const isRent = listing.toLowerCase() === 'rent'
  const suggestions = location.trim() === '' ? AREAS : AREAS.filter(a => a.toLowerCase().includes(location.toLowerCase()))

  const buildParams = useCallback(() => {
    const p: Record<string, any> = { page }
    if (location)                    p.location = location
    if (listing !== 'All')           p.listing  = listing.toLowerCase()
    if (propType !== 'All')          p.type     = propType.toLowerCase()
    if (badgeOnly)                   p.blue_badge_only = true

    if (isRent && priceInput) {
      p.max_price = priceInput.replace(/,/g, '')
    } else if (!isRent && pricePreset) {
      const [min, max] = pricePreset.split('-')
      if (min) p.min_price = min
      if (max) p.max_price = max
    }
    return p
  }, [location, listing, propType, badgeOnly, priceInput, pricePreset, page, isRent])

  const fetchProperties = useCallback(async () => {
    setLoading(true)
    try {
      const res = await propertiesApi.list(buildParams())
      setProperties(res.data.data)
      setTotal(res.data.total)
      setLastPage(res.data.last_page)
    } catch { setProperties([]) }
    finally  { setLoading(false) }
  }, [buildParams])

  useEffect(() => { fetchProperties() }, [fetchProperties])

  const clearAll = () => {
    setLocation(''); setListing('All'); setPropType('All')
    setPriceInput(''); setPricePreset(''); setBadgeOnly(false); setPage(1)
  }

  const activeFilterCount = [
    location !== '',
    listing !== 'All',
    propType !== 'All',
    isRent ? priceInput !== '' : pricePreset !== '',
    badgeOnly,
  ].filter(Boolean).length

  return (
    <>
      <Navbar />
      <div className="flex min-h-screen bg-paper">

        {/* ── SIDEBAR ── */}
        <aside className={`w-72 flex-shrink-0 bg-white border-r border-sand sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto
          ${showFilters ? 'block' : 'hidden lg:block'}`}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xs font-bold uppercase tracking-[1.5px] text-dust">Filters</h2>
              {activeFilterCount > 0 && (
                <button onClick={clearAll} className="text-xs text-red-400 hover:text-red-600">Clear all</button>
              )}
            </div>

            {/* Location */}
            <div className="mb-6 relative">
              <div className="text-[9px] font-bold uppercase tracking-[1.5px] text-dust mb-2">Location</div>
              <div className={`flex items-center gap-2 px-3 py-2.5 border rounded-lg bg-paper transition-colors
                ${locFocus ? 'border-ink' : 'border-sand'}`}>
                <MapPin className="w-3.5 h-3.5 text-dust" />
                <input value={location} onChange={e => setLocation(e.target.value)}
                  onFocus={() => setLocFocus(true)} onBlur={() => setTimeout(() => setLocFocus(false), 150)}
                  placeholder="Any location..." className="flex-1 border-none outline-none text-sm bg-transparent placeholder:text-dust" />
                {location && <button onClick={() => setLocation('')}><X className="w-3 h-3 text-dust" /></button>}
              </div>
              {locFocus && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-sand rounded-xl shadow-modal z-50 overflow-hidden">
                  <div className="flex flex-wrap gap-1.5 p-3">
                    {suggestions.slice(0,10).map(s => (
                      <button key={s} onMouseDown={() => { setLocation(s); setLocFocus(false) }}
                        className={`px-2.5 py-1 rounded-full text-xs border ${location === s ? 'bg-ink text-white border-ink' : 'bg-cream text-ink border-sand'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Listing type */}
            <div className="mb-6">
              <div className="text-[9px] font-bold uppercase tracking-[1.5px] text-dust mb-2">Listing Type</div>
              <div className="flex flex-wrap gap-1.5">
                {LISTING_TYPES.map(t => (
                  <button key={t} onClick={() => { setListing(t); setPriceInput(''); setPricePreset('') }}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-all
                      ${listing === t ? 'bg-ink text-white border-ink' : 'bg-white text-stone border-sand hover:border-stone'}`}>
                    {t === 'All' ? 'All' : 'For ' + t}
                  </button>
                ))}
              </div>
            </div>

            {/* Property type */}
            <div className="mb-6">
              <div className="text-[9px] font-bold uppercase tracking-[1.5px] text-dust mb-2">Property Type</div>
              <div className="flex flex-wrap gap-1.5">
                {PROP_TYPES.map(t => (
                  <button key={t} onClick={() => setPropType(t)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-all
                      ${propType === t ? 'bg-gold text-white border-gold' : 'bg-white text-stone border-sand hover:border-stone'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Price */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[9px] font-bold uppercase tracking-[1.5px] text-dust">
                  {isRent ? 'Max Rent / Month' : 'Budget'}
                </div>
                <span className="text-[9px] text-dust italic">Optional</span>
              </div>
              {isRent ? (
                <>
                  <div className={`flex items-center gap-2 px-3 py-2.5 border rounded-lg bg-paper mb-2 transition-colors ${priceInput ? 'border-ink' : 'border-sand'}`}>
                    <span className="text-xs text-stone">UGX</span>
                    <input type="number" value={priceInput} onChange={e => setPriceInput(e.target.value)}
                      placeholder="Max monthly rent..."
                      className="flex-1 border-none outline-none text-sm bg-transparent placeholder:text-dust" />
                    {priceInput && <button onClick={() => setPriceInput('')}><X className="w-3 h-3 text-dust" /></button>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {RENT_PRESETS.map(p => {
                      const v = p.replace(/,/g,'')
                      return <button key={p} onClick={() => setPriceInput(priceInput===v?'':v)}
                        className={`px-2.5 py-1 rounded-full text-xs border ${priceInput===v ? 'bg-forest text-white border-forest' : 'bg-white text-stone border-sand'}`}>{p}</button>
                    })}
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {BUY_PRESETS.map(p => (
                    <button key={p.l} onClick={() => setPricePreset(pricePreset===p.v&&p.v!==''?'':p.v)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-all
                        ${pricePreset===p.v&&p.v!=='' ? 'bg-ink text-white border-ink' : 'bg-white text-stone border-sand hover:border-stone'}`}>
                      {p.l}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Seller type */}
            <div className="mb-6">
              <div className="text-[9px] font-bold uppercase tracking-[1.5px] text-dust mb-2">Seller</div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={badgeOnly} onChange={e => setBadgeOnly(e.target.checked)}
                  className="accent-ink w-3.5 h-3.5" />
                <span className="text-sm text-ink">Blue Badge sellers only</span>
              </label>
            </div>

            <button onClick={() => { setPage(1); fetchProperties() }} className="btn-primary w-full text-sm">Apply Filters</button>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main className="flex-1 p-6">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="text-sm text-stone">
              <strong className="text-ink">{total} {total === 1 ? 'property' : 'properties'}</strong>
              {location && <span> in <strong className="text-gold">{location}</strong></span>}
              {!location && <span> across Uganda</span>}
            </div>
            <div className="flex items-center gap-3">
              <select value={sort} onChange={e => setSort(e.target.value)}
                className="text-sm border border-sand rounded-lg px-3 py-2 text-ink outline-none bg-white">
                <option value="newest">Newest first</option>
                <option value="price_asc">Price: Low → High</option>
                <option value="price_desc">Price: High → Low</option>
                <option value="rating">Top rated</option>
              </select>
              <button onClick={() => setShowFilters(v => !v)}
                className="lg:hidden flex items-center gap-2 px-3 py-2 border border-sand rounded-lg text-sm text-stone">
                <SlidersHorizontal className="w-4 h-4" />
                Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
              </button>
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="card h-80 animate-pulse bg-sand" />
              ))}
            </div>
          ) : properties.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {properties.map(p => <PropertyCard key={p.id} property={p} />)}
              </div>
              {/* Pagination */}
              {lastPage > 1 && (
                <div className="flex items-center justify-center gap-3 mt-10">
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                    className="btn-outline py-2 px-4 text-sm disabled:opacity-40">Previous</button>
                  <span className="text-sm text-stone">Page {page} of {lastPage}</span>
                  <button disabled={page === lastPage} onClick={() => setPage(p => p + 1)}
                    className="btn-outline py-2 px-4 text-sm disabled:opacity-40">Next</button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-20">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-lg font-medium text-ink mb-2">No properties found</h3>
              <p className="text-sm text-stone mb-6">
                {location ? `No listings found in "${location}".` : 'No listings match your filters.'}
                {' '}Try adjusting your search.
              </p>
              <button onClick={clearAll} className="btn-primary">Clear Filters</button>
            </div>
          )}
        </main>
      </div>
    </>
  )
}
