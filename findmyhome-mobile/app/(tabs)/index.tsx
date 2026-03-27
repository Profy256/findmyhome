import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, FlatList, RefreshControl } from 'react-native'
import { router } from 'expo-router'
import { propertiesApi } from '@/lib/api'
import { PropertyCard } from '@/components/property/PropertyCard'
import { C, AREAS } from '@/lib/utils'
import { useAuthStore } from '@/lib/store'
import { KycBanner, Loading } from '@/components/ui'

const CATEGORIES = [
  { key: 'house',     label: 'Houses',     count: '820+', emoji: '🏡',  bg: '#0f2027' },
  { key: 'airbnb',    label: 'Airbnb',     count: '180+', emoji: '🏖️', bg: '#2d1b69' },
  { key: 'lodge',     label: 'Lodges',     count: '140+', emoji: '🏨',  bg: '#1c3b2f' },
  { key: 'rental',    label: 'Rentals',    count: '540+', emoji: '🏠',  bg: '#5a2b12' },
  { key: 'apartment', label: 'Apartments', count: '640+', emoji: '🏢',  bg: '#1a1a2e' },
  { key: 'land',      label: 'Land',       count: '310+', emoji: '🌿',  bg: '#134e5e' },
]

export default function HomeScreen() {
  const [featured,    setFeatured]    = useState<any[]>([])
  const [recent,      setRecent]      = useState<any[]>([])
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [locQuery,    setLocQuery]    = useState('')
  const [showSuggest, setShowSuggest] = useState(false)
  const { user, isSeller }           = useAuthStore()

  const suggestions = locQuery.trim() === ''
    ? AREAS
    : AREAS.filter(a => a.toLowerCase().includes(locQuery.toLowerCase()))

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const [f, r] = await Promise.all([
        propertiesApi.list({ featured: true }),
        propertiesApi.list({ page: 1 }),
      ])
      setFeatured(f.data.data?.slice(0, 4) ?? [])
      setRecent(r.data.data?.slice(0, 6) ?? [])
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { load() }, [])

  const doSearch = () => {
    if (locQuery.trim()) router.push(`/(tabs)/search?location=${encodeURIComponent(locQuery)}`)
    else router.push('/(tabs)/search')
    setShowSuggest(false)
  }

  if (loading) return <Loading full />

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.paper }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.gold} />}
      showsVerticalScrollIndicator={false}>

      {/* HERO */}
      <View style={{ backgroundColor: C.ink, paddingTop: 60, paddingHorizontal: 20, paddingBottom: 28 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <View style={{ height: 1, width: 20, backgroundColor: C.gold2 }} />
          <Text style={{ fontSize: 9, fontWeight: '700', color: C.gold2, textTransform: 'uppercase', letterSpacing: 2 }}>
            Uganda's Premier Marketplace
          </Text>
        </View>
        <Text style={{ fontSize: 40, fontWeight: '300', color: C.white, letterSpacing: -1, lineHeight: 46, marginBottom: 8 }}>
          Find Your{'\n'}<Text style={{ color: C.gold2, fontStyle: 'italic' }}>Perfect Home</Text>
        </Text>
        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 24, lineHeight: 20 }}>
          Verified properties across Uganda. KYC-checked sellers.
        </Text>

        {/* Search bar */}
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 2, gap: 10 }}>
            <Text style={{ fontSize: 14 }}>📍</Text>
            <TextInput
              value={locQuery}
              onChangeText={v => { setLocQuery(v); setShowSuggest(true) }}
              onFocus={() => setShowSuggest(true)}
              onBlur={() => setTimeout(() => setShowSuggest(false), 200)}
              placeholder="Search any location..."
              placeholderTextColor={C.dust}
              style={{ flex: 1, fontSize: 14, color: C.ink, paddingVertical: 12 }}
            />
            {locQuery !== '' && (
              <TouchableOpacity onPress={() => setLocQuery('')}>
                <Text style={{ fontSize: 18, color: C.dust }}>×</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Suggestions */}
          {showSuggest && (
            <View style={{ backgroundColor: C.white, borderRadius: 12, marginTop: 6, padding: 12 }}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: C.dust, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>
                {locQuery ? 'Matching areas' : 'Popular areas'}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {suggestions.slice(0, 10).map(s => (
                  <TouchableOpacity key={s} onPress={() => { setLocQuery(s); setShowSuggest(false); router.push(`/(tabs)/search?location=${s}`) }}
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, borderWidth: 1, borderColor: C.sand, backgroundColor: C.cream }}>
                    <Text style={{ fontSize: 12, color: C.ink }}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <TouchableOpacity onPress={doSearch} activeOpacity={0.85}
            style={{ marginTop: 10, backgroundColor: C.gold, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ color: C.white, fontWeight: '700', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>
              🔍 Search Properties
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={{ flexDirection: 'row', marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', gap: 20 }}>
          {[['2.4K+','Listings'],['1.2K+','Sellers'],['850','Sales']].map(([n, l]) => (
            <View key={l}>
              <Text style={{ fontSize: 20, fontWeight: '300', color: C.white }}>{n}</Text>
              <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 }}>{l}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ padding: 16 }}>
        {/* KYC banner for sellers */}
        {isSeller() && user?.kyc_status !== 'verified' && (
          <KycBanner status={user?.kyc_status ?? 'none'} onPress={() => router.push('/dashboard/kyc')} />
        )}

        {/* Categories */}
        <Text style={{ fontSize: 9, fontWeight: '700', color: C.gold, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>Browse By Type</Text>
        <Text style={{ fontSize: 24, fontWeight: '300', color: C.ink, marginBottom: 16 }}>What Are You Looking For?</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 }}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity key={cat.key} onPress={() => router.push(`/(tabs)/search?type=${cat.key}`)} activeOpacity={0.85}
              style={{ width: '47%', height: 100, borderRadius: 16, backgroundColor: cat.bg, overflow: 'hidden', padding: 14, justifyContent: 'flex-end' }}>
              <Text style={{ fontSize: 28, position: 'absolute', top: 14, left: 14 }}>{cat.emoji}</Text>
              <Text style={{ fontSize: 15, fontWeight: '600', color: C.white }}>{cat.label}</Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{cat.count}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Featured */}
        {featured.length > 0 && (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
              <View>
                <Text style={{ fontSize: 9, fontWeight: '700', color: C.gold, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>Curated</Text>
                <Text style={{ fontSize: 24, fontWeight: '300', color: C.ink }}>Featured</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/(tabs)/search')}>
                <Text style={{ fontSize: 12, color: C.gold, fontWeight: '600' }}>See all →</Text>
              </TouchableOpacity>
            </View>
            {featured.map(p => <PropertyCard key={p.id} property={p} onPress={() => router.push(`/property/${p.id}`)} />)}
          </>
        )}

        {/* Recent */}
        {recent.length > 0 && (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14, marginTop: 8 }}>
              <View>
                <Text style={{ fontSize: 9, fontWeight: '700', color: C.gold, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>Just Listed</Text>
                <Text style={{ fontSize: 24, fontWeight: '300', color: C.ink }}>Recent</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/(tabs)/search')}>
                <Text style={{ fontSize: 12, color: C.gold, fontWeight: '600' }}>See all →</Text>
              </TouchableOpacity>
            </View>
            {recent.map(p => <PropertyCard key={p.id} property={p} onPress={() => router.push(`/property/${p.id}`)} />)}
          </>
        )}

        {/* Trust */}
        <View style={{ backgroundColor: C.forest, borderRadius: 16, padding: 20, marginTop: 8, marginBottom: 16 }}>
          <Text style={{ fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 14 }}>Why Trust Us</Text>
          {[['🛡️','KYC Verified Sellers','Every seller is identity-checked'],['🔵','Blue Badge Program','Premium verified agents'],['💬','WhatsApp Leads','All leads tracked & notified'],['⭐','Genuine Reviews','Only real buyers can review']].map(([e, l, s]) => (
            <View key={l} style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 16 }}>{e}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: C.white }}>{l}</Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{s}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}
