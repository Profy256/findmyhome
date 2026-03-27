import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, FlatList, RefreshControl } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { propertiesApi, ratingsApi } from '@/lib/api'
import { PropertyCard } from '@/components/property/PropertyCard'
import { C, timeAgo } from '@/lib/utils'
import { Loading, Empty, Card, Divider } from '@/components/ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function SellerProfileScreen() {
  const { id }                      = useLocalSearchParams<{ id: string }>()
  const [seller,    setSeller]      = useState<any>(null)
  const [listings,  setListings]    = useState<any[]>([])
  const [reviews,   setReviews]     = useState<any>(null)
  const [loading,   setLoading]     = useState(true)
  const [refreshing,setRefreshing]  = useState(false)
  const insets                      = useSafeAreaInsets()

  const load = async (refresh = false) => {
    if (!refresh) setLoading(true)
    try {
      const [listRes, revRes] = await Promise.all([
        propertiesApi.list({ seller_id: id }),
        ratingsApi.seller(id),
      ])
      setListings(listRes.data.data ?? [])
      setReviews(revRes.data)
      if (listRes.data.data?.[0]?.seller) setSeller(listRes.data.data[0].seller)
    } catch {} finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { load() }, [id])

  if (loading) return <Loading full />

  const avg   = reviews?.seller?.average_rating ?? 0
  const total = reviews?.seller?.total_reviews  ?? 0

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true) }} tintColor={C.gold} />}>

        {/* Header */}
        <View style={{ backgroundColor: C.ink, paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 28 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>← Back</Text>
          </TouchableOpacity>

          <View style={{ alignItems: 'center' }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 24, fontWeight: '600', color: C.white }}>
                {(seller?.company_name ?? seller?.name)?.[0]}
              </Text>
            </View>
            <Text style={{ fontSize: 22, fontWeight: '300', color: C.white, textAlign: 'center' }}>
              {seller?.company_name ?? seller?.name}
              {seller?.blue_badge ? '  🔵' : ''}
            </Text>
            <Text style={{ fontSize: 12, color: C.forest, fontWeight: '700', marginTop: 4 }}>
              {seller?.role === 'company' ? 'Registered Business ✔' : 'Identity Verified ✔'}
            </Text>
            {total > 0 && (
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>
                ⭐ {avg} ({total} reviews) · {listings.length} listings
              </Text>
            )}
          </View>
        </View>

        <View style={{ padding: 16 }}>
          {/* Listings */}
          <Text style={{ fontSize: 18, fontWeight: '300', color: C.ink, marginBottom: 14 }}>
            Active Listings ({listings.length})
          </Text>
          {listings.length === 0 ? (
            <Empty emoji="🏠" title="No active listings" />
          ) : (
            listings.map(p => <PropertyCard key={p.id} property={p} onPress={() => router.push(`/property/${p.id}`)} />)
          )}

          {/* Reviews */}
          <Text style={{ fontSize: 18, fontWeight: '300', color: C.ink, marginTop: 24, marginBottom: 14 }}>
            Buyer Reviews ({total})
          </Text>

          {/* Star breakdown */}
          {total > 0 && (
            <Card style={{ padding: 16, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 14 }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 42, fontWeight: '300', color: C.ink }}>{avg}</Text>
                  <Text style={{ fontSize: 14, color: C.gold }}>{'⭐'.repeat(Math.round(avg))}</Text>
                  <Text style={{ fontSize: 11, color: C.dust, marginTop: 2 }}>{total} reviews</Text>
                </View>
                <View style={{ flex: 1 }}>
                  {[5,4,3,2,1].map(star => {
                    const pct = reviews?.breakdown?.[star]?.percentage ?? 0
                    return (
                      <View key={star} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Text style={{ fontSize: 10, color: C.stone, width: 10 }}>{star}</Text>
                        <View style={{ flex: 1, height: 4, backgroundColor: C.sand, borderRadius: 2, overflow: 'hidden' }}>
                          <View style={{ width: `${pct}%`, height: '100%', backgroundColor: C.gold, borderRadius: 2 }} />
                        </View>
                        <Text style={{ fontSize: 10, color: C.dust, width: 22 }}>{reviews?.breakdown?.[star]?.count ?? 0}</Text>
                      </View>
                    )
                  })}
                </View>
              </View>
            </Card>
          )}

          {(reviews?.reviews?.data?.length ?? 0) === 0 ? (
            <Empty emoji="⭐" title="No reviews yet" />
          ) : (
            reviews.reviews.data.map((r: any) => (
              <Card key={r.id} style={{ padding: 14, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: C.ink }}>{r.buyer?.name}</Text>
                    {r.property?.title && <Text style={{ fontSize: 11, color: C.stone, marginTop: 1 }}>Re: {r.property.title}</Text>}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 12, color: C.gold }}>{'⭐'.repeat(r.stars)}</Text>
                    <Text style={{ fontSize: 10, color: C.dust, marginTop: 2 }}>{timeAgo(r.created_at)}</Text>
                  </View>
                </View>
                {r.review && <Text style={{ fontSize: 13, color: C.stone, lineHeight: 19 }}>{r.review}</Text>}
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  )
}
