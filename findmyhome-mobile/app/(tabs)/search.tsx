import { useState, useEffect, useCallback } from 'react'
import { View, Text, TextInput, ScrollView, FlatList, TouchableOpacity, RefreshControl } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { propertiesApi } from '@/lib/api'
import { PropertyCard } from '@/components/property/PropertyCard'
import { C, AREAS, formatUGX } from '@/lib/utils'
import { Loading, Empty, PillSelector } from '@/components/ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const LISTING_OPTS = ['All', 'Sale', 'Rent', 'Short Stay']
const TYPE_OPTS    = ['All', 'House', 'Airbnb', 'Lodge', 'Rental', 'Apartment', 'Land']
const RENT_PRESETS = ['200K', '350K', '500K', '800K', '1.2M', '2M']
const RENT_VALUES  = [200000, 350000, 500000, 800000, 1200000, 2000000]
const BUY_PRESETS  = ['Any', '<50M', '50-150M', '150-300M', '300M+']

export default function SearchScreen() {
  const params                      = useLocalSearchParams<{ location?: string; type?: string; listing?: string }>()
  const insets                      = useSafeAreaInsets()
  const [properties, setProperties] = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [total,      setTotal]      = useState(0)
  const [page,       setPage]       = useState(1)
  const [lastPage,   setLastPage]   = useState(1)

  const [locQuery,   setLocQuery]   = useState(params.location ?? '')
  const [locFocus,   setLocFocus]   = useState(false)
  const [listing,    setListing]    = useState(params.listing ?? 'All')
  const [propType,   setPropType]   = useState(params.type ?? 'All')
  const [priceInput, setPriceInput] = useState('')
  const [pricePreset,setPricePreset]= useState('')
  const [showPrice,  setShowPrice]  = useState(false)

  const isRent = listing === 'Rent' || listing === 'Short Stay'
  const suggestions = locQuery.trim() === '' ? AREAS : AREAS.filter(a => a.toLowerCase().includes(locQuery.toLowerCase()))

  const buildParams = useCallback(() => {
    const p: Record<string, any> = { page }
    if (locQuery.trim())  p.location = locQuery
    if (listing !== 'All') p.listing = listing.toLowerCase().replace(' ', '_')
    if (propType !== 'All') p.type  = propType.toLowerCase().replace(' ', '_')
    if (isRent && priceInput)       p.max_price = parseInt(priceInput)
    if (!isRent && pricePreset && pricePreset !== 'Any') {
      if (pricePreset === '<50M')    { p.max_price = 50000000 }
      else if (pricePreset === '50-150M')  { p.min_price = 50000000;  p.max_price = 150000000 }
      else if (pricePreset === '150-300M') { p.min_price = 150000000; p.max_price = 300000000 }
      else if (pricePreset === '300M+')    { p.min_price = 300000000 }
    }
    return p
  }, [locQuery, listing, propType, priceInput, pricePreset, page, isRent])

  const load = useCallback(async (reset = false) => {
    if (reset) { setPage(1); setLoading(true) }
    else setRefreshing(false)
    try {
      const r = await propertiesApi.list(buildParams())
      if (reset || page === 1) setProperties(r.data.data)
      else setProperties(prev => [...prev, ...r.data.data])
      setTotal(r.data.total); setLastPage(r.data.last_page)
    } catch {} finally { setLoading(false); setRefreshing(false) }
  }, [buildParams, page])

  useEffect(() => { load(true) }, [locQuery, listing, propType, priceInput, pricePreset])
  useEffect(() => { if (page > 1) load() }, [page])

  const clearAll = () => { setLocQuery(''); setListing('All'); setPropType('All'); setPriceInput(''); setPricePreset('') }

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      {/* Sticky header */}
      <View style={{ backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.sand, paddingTop: insets.top + 8, paddingBottom: 12, paddingHorizontal: 16 }}>
        {/* Location search */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.paper, borderRadius: 10, borderWidth: 1.5, borderColor: locFocus ? C.ink : C.sand, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 10 }}>
          <Text style={{ fontSize: 14, marginRight: 8 }}>📍</Text>
          <TextInput
            value={locQuery}
            onChangeText={setLocQuery}
            onFocus={() => setLocFocus(true)}
            onBlur={() => setTimeout(() => setLocFocus(false), 200)}
            placeholder="Search any location in Uganda..."
            placeholderTextColor={C.dust}
            style={{ flex: 1, fontSize: 14, color: C.ink, paddingVertical: 10 }}
          />
          {locQuery !== '' && <TouchableOpacity onPress={() => setLocQuery('')}><Text style={{ fontSize: 18, color: C.dust }}>×</Text></TouchableOpacity>}
        </View>

        {/* Location suggestions */}
        {locFocus && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {suggestions.slice(0, 12).map(s => (
                <TouchableOpacity key={s} onPress={() => { setLocQuery(s); setLocFocus(false) }}
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, backgroundColor: locQuery===s ? C.ink : C.cream, borderWidth: 1, borderColor: locQuery===s ? C.ink : C.sand }}>
                  <Text style={{ fontSize: 12, color: locQuery===s ? C.white : C.ink }}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {LISTING_OPTS.map(o => (
              <TouchableOpacity key={o} onPress={() => { setListing(o); setPriceInput(''); setPricePreset('') }}
                style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100, backgroundColor: listing===o ? C.ink : C.white, borderWidth: 1, borderColor: listing===o ? C.ink : C.sand }}>
                <Text style={{ fontSize: 11, fontWeight: listing===o?'600':'400', color: listing===o ? C.white : C.stone }}>{o}</Text>
              </TouchableOpacity>
            ))}
            <View style={{ width: 1, backgroundColor: C.sand, marginHorizontal: 2 }} />
            {TYPE_OPTS.map(o => (
              <TouchableOpacity key={o} onPress={() => setPropType(o)}
                style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100, backgroundColor: propType===o ? C.gold : C.white, borderWidth: 1, borderColor: propType===o ? C.gold : C.sand }}>
                <Text style={{ fontSize: 11, fontWeight: propType===o?'600':'400', color: propType===o ? C.white : C.stone }}>{o}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowPrice(v => !v)}
              style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100, backgroundColor: showPrice||(priceInput||pricePreset) ? C.forest : C.white, borderWidth: 1, borderColor: showPrice ? C.forest : C.sand }}>
              <Text style={{ fontSize: 11, fontWeight: '500', color: showPrice ? C.white : C.stone }}>
                💰 {isRent ? 'Max Rent' : 'Budget'}{(priceInput||pricePreset) ? ' ✓' : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Price panel */}
        {showPrice && (
          <View style={{ backgroundColor: C.cream, borderRadius: 12, padding: 14, marginTop: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: C.ink, marginBottom: 8 }}>
              {isRent ? 'Max monthly rent (UGX)' : 'Budget (UGX)'}
            </Text>
            {isRent ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 8, borderWidth: 1.5, borderColor: priceInput ? C.forest : C.sand, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 }}>
                  <Text style={{ fontSize: 12, color: C.stone, marginRight: 6 }}>UGX</Text>
                  <TextInput value={priceInput} onChangeText={setPriceInput} keyboardType="numeric"
                    placeholder="Enter max rent..." placeholderTextColor={C.dust}
                    style={{ flex: 1, fontSize: 13, color: C.ink }} />
                  {priceInput ? <TouchableOpacity onPress={() => setPriceInput('')}><Text style={{ fontSize: 16, color: C.dust }}>×</Text></TouchableOpacity> : null}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {RENT_PRESETS.map((p, i) => {
                      const v = String(RENT_VALUES[i])
                      return <TouchableOpacity key={p} onPress={() => setPriceInput(priceInput===v?'':v)}
                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, backgroundColor: priceInput===v ? C.forest : C.white, borderWidth: 1, borderColor: priceInput===v ? C.forest : C.sand }}>
                        <Text style={{ fontSize: 11, color: priceInput===v ? C.white : C.stone }}>{p}</Text>
                      </TouchableOpacity>
                    })}
                  </View>
                </ScrollView>
              </>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {BUY_PRESETS.map(p => (
                    <TouchableOpacity key={p} onPress={() => setPricePreset(pricePreset===p&&p!=='Any'?'':p)}
                      style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, backgroundColor: pricePreset===p&&p!=='Any' ? C.ink : C.white, borderWidth: 1, borderColor: pricePreset===p&&p!=='Any' ? C.ink : C.sand }}>
                      <Text style={{ fontSize: 11, color: pricePreset===p&&p!=='Any' ? C.white : C.stone }}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        )}
      </View>

      {/* Results */}
      {loading ? <Loading /> : (
        <FlatList
          data={properties}
          keyExtractor={p => p.id}
          renderItem={({ item }) => <PropertyCard property={item} onPress={() => router.push(`/property/${item.id}`)} />}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setPage(1); load(true) }} tintColor={C.gold} />}
          ListHeaderComponent={
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 13, color: C.stone }}>
                <Text style={{ fontWeight: '600', color: C.ink }}>{total}</Text>
                {locQuery ? ` in ${locQuery}` : ' across Uganda'}
              </Text>
              {(locQuery || listing !== 'All' || propType !== 'All' || priceInput || pricePreset) && (
                <TouchableOpacity onPress={clearAll}>
                  <Text style={{ fontSize: 12, color: C.red }}>Clear all</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListEmptyComponent={
            <Empty emoji="🔍" title="No properties found"
              description={locQuery ? `No listings in "${locQuery}".` : 'Try adjusting your filters.'}
              action={<TouchableOpacity onPress={clearAll} style={{ backgroundColor: C.ink, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}><Text style={{ color: C.white, fontSize: 13, fontWeight: '600' }}>Clear Filters</Text></TouchableOpacity>} />
          }
          onEndReached={() => { if (page < lastPage) setPage(p => p + 1) }}
          onEndReachedThreshold={0.5}
        />
      )}
    </View>
  )
}
