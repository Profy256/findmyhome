import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Linking, Alert, Share } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { Image } from 'expo-image'
import { propertiesApi, ratingsApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { C, formatUGX, buildWhatsAppUrl, buildWhatsAppMessage, timeAgo } from '@/lib/utils'
import { Loading, Badge, Card, Divider, Btn } from '@/components/ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'

export default function PropertyDetailScreen() {
  const { id }                      = useLocalSearchParams<{ id: string }>()
  const [property, setProperty]     = useState<any>(null)
  const [reviews,  setReviews]      = useState<any[]>([])
  const [canRate,  setCanRate]      = useState(false)
  const [loading,  setLoading]      = useState(true)
  const [contacting, setContacting] = useState(false)
  const { user, isAuthenticated }   = useAuthStore()
  const insets                      = useSafeAreaInsets()

  useEffect(() => {
    const load = async () => {
      try {
        const [pRes, rRes] = await Promise.all([
          propertiesApi.get(id),
          ratingsApi.seller(id).catch(() => ({ data: { reviews: { data: [] } } })),
        ])
        setProperty(pRes.data.property ?? pRes.data)
        setReviews(rRes.data.reviews?.data ?? [])

        if (isAuthenticated() && user?.role === 'buyer') {
          const cr = await ratingsApi.canRate(pRes.data.property?.seller_id ?? pRes.data.seller_id).catch(() => null)
          if (cr) setCanRate(cr.data.can_rate)
        }
      } catch { Toast.show({ type: 'error', text1: 'Failed to load property.' }) }
      finally { setLoading(false) }
    }
    load()
  }, [id])

  const handleWhatsApp = async () => {
    if (!isAuthenticated()) { router.push('/(auth)/login'); return }
    setContacting(true)
    try {
      await propertiesApi.whatsapp(id)
      const url = buildWhatsAppUrl(property.seller.phone, buildWhatsAppMessage(property.title, user?.name ?? 'A buyer'))
      await Linking.openURL(url)
    } catch { Toast.show({ type: 'error', text1: 'Could not open WhatsApp.' }) }
    finally { setContacting(false) }
  }

  const handleEnquire = async () => {
    if (!isAuthenticated()) { router.push('/(auth)/login'); return }
    setContacting(true)
    try {
      await propertiesApi.enquire(id)
      Toast.show({ type: 'success', text1: 'Enquiry sent!', text2: 'The seller has been notified.' })
    } catch { Toast.show({ type: 'error', text1: 'Failed to send enquiry.' }) }
    finally { setContacting(false) }
  }

  const handleShare = async () => {
    const origin = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://findmyhomeuganda.com').replace(/\/$/, '')
    const webUrl = `${origin}/properties/${id}`
    await Share.share({
      message: `Check out this property on FindMyHome:\n${property.title}\n${property.location}\n${formatUGX(property.price)}\n\n${webUrl}`,
      url: webUrl,
    })
  }

  if (loading) return <Loading full />
  if (!property) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper }}>
      <Text style={{ color: C.stone }}>Property not found</Text>
    </View>
  )

  const isShortStay = property.listing_type === 'short_stay' || property.property_type === 'airbnb' || property.property_type === 'lodge'
  const WEB_URL     = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://findmyhomeuganda.com').replace(/\/$/, '')
  const mapsUrl = property.has_map_location ? `https://maps.google.com/?q=${property.land_title_lat},${property.land_title_lng}` : null

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Image */}
        <View style={{ height: 300, backgroundColor: '#1a2a3a', position: 'relative' }}>
          {property.photos?.[0] ? (
            <Image source={{ uri: property.photos[0] }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 64 }}>🏠</Text>
            </View>
          )}

          {/* Back button */}
          <TouchableOpacity onPress={() => router.back()}
            style={{ position: 'absolute', top: insets.top + 12, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 18, color: C.ink }}>‹</Text>
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity onPress={handleShare}
            style={{ position: 'absolute', top: insets.top + 12, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 14 }}>⬆️</Text>
          </TouchableOpacity>

          {/* Badges */}
          <View style={{ position: 'absolute', bottom: 12, left: 12, flexDirection: 'row', gap: 6 }}>
            <View style={{ backgroundColor: 'rgba(28,28,26,0.85)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
              <Text style={{ color: C.white, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>
                {isShortStay ? 'Short Stay' : property.listing_type === 'sale' ? 'For Sale' : 'For Rent'}
              </Text>
            </View>
            {property.featured && (
              <View style={{ backgroundColor: 'rgba(184,150,90,0.95)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                <Text style={{ color: C.white, fontSize: 10, fontWeight: '700' }}>★ Featured</Text>
              </View>
            )}
            {property.land_title_verified && (
              <View style={{ backgroundColor: 'rgba(45,74,62,0.9)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                <Text style={{ color: C.white, fontSize: 10, fontWeight: '700' }}>📜 Title Verified</Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ padding: 20 }}>
          {/* Price & title */}
          <Text style={{ fontSize: 30, fontWeight: '300', color: C.ink, letterSpacing: -0.5 }}>
            {formatUGX(property.price)}
            {property.listing_type === 'rent' && <Text style={{ fontSize: 14, color: C.dust }}> /mo</Text>}
            {isShortStay && <Text style={{ fontSize: 14, color: C.dust }}> /night</Text>}
          </Text>
          <Text style={{ fontSize: 20, fontWeight: '400', color: C.ink, marginTop: 4, marginBottom: 10, lineHeight: 26 }}>{property.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 }}>
            <Text style={{ fontSize: 14 }}>📍</Text>
            <Text style={{ fontSize: 14, color: C.stone }}>{property.location}</Text>
          </View>

          {/* Specs grid */}
          {(property.bedrooms || property.bathrooms || property.size || property.max_guests) && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
              {property.bedrooms   && <View style={{ backgroundColor: C.cream, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}><Text style={{ fontSize: 13, color: C.ink }}>🛏 {property.bedrooms} Bedrooms</Text></View>}
              {property.bathrooms  && <View style={{ backgroundColor: C.cream, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}><Text style={{ fontSize: 13, color: C.ink }}>🚿 {property.bathrooms} Bathrooms</Text></View>}
              {property.size       && <View style={{ backgroundColor: C.cream, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}><Text style={{ fontSize: 13, color: C.ink }}>📐 {property.size}</Text></View>}
              {property.max_guests && <View style={{ backgroundColor: C.cream, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}><Text style={{ fontSize: 13, color: C.ink }}>👥 Max {property.max_guests} guests</Text></View>}
            </View>
          )}

          {/* Amenities */}
          {property.amenities?.length > 0 && (
            <Card style={{ padding: 16, marginBottom: 20 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink, marginBottom: 10 }}>Amenities</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {property.amenities.map((a: string) => (
                  <View key={a} style={{ backgroundColor: C.cream, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: C.sand }}>
                    <Text style={{ fontSize: 12, color: C.stone }}>✓ {a}</Text>
                  </View>
                ))}
              </View>
            </Card>
          )}

          {/* Land title map */}
          {mapsUrl && (
            <TouchableOpacity onPress={() => Linking.openURL(mapsUrl)} activeOpacity={0.8}
              style={{ backgroundColor: C.forest, borderRadius: 14, padding: 16, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 24 }}>🗺️</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: C.white }}>View Exact Location</Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Land title coordinates · Opens Google Maps</Text>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 18 }}>›</Text>
            </TouchableOpacity>
          )}

          {/* Description */}
          <Card style={{ padding: 16, marginBottom: 20 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink, marginBottom: 8 }}>About This Property</Text>
            <Text style={{ fontSize: 13, color: C.stone, lineHeight: 20 }}>{property.description}</Text>
          </Card>

          {/* Seller */}
          <Card style={{ padding: 16, marginBottom: 20 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: C.dust, marginBottom: 12 }}>Listed By</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: C.white, fontSize: 16, fontWeight: '600' }}>{(property.seller?.display_name ?? property.seller?.name)?.[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '500', color: C.ink }}>
                  {property.seller?.display_name ?? property.seller?.name}
                  {property.seller?.blue_badge ? '  🔵' : ''}
                </Text>
                <Text style={{ fontSize: 12, color: C.forest, fontWeight: '600', marginTop: 2 }}>
                  {property.trust_label ?? '✓ Verified'}
                </Text>
                {(property.seller?.average_rating ?? 0) > 0 && (
                  <Text style={{ fontSize: 12, color: C.stone, marginTop: 2 }}>
                    ⭐ {property.seller.average_rating} ({property.seller.total_reviews} reviews)
                  </Text>
                )}
              </View>
            </View>
          </Card>

          {/* Reviews */}
          {reviews.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '500', color: C.ink, marginBottom: 12 }}>
                Buyer Reviews ({reviews.length})
              </Text>
              {reviews.slice(0, 3).map((r: any) => (
                <Card key={r.id} style={{ padding: 14, marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: C.ink }}>{r.buyer?.name}</Text>
                    <Text style={{ fontSize: 12, color: C.gold }}>{'⭐'.repeat(r.stars)}</Text>
                  </View>
                  {r.review && <Text style={{ fontSize: 13, color: C.stone, lineHeight: 19 }}>{r.review}</Text>}
                  <Text style={{ fontSize: 10, color: C.dust, marginTop: 6 }}>{timeAgo(r.created_at)}</Text>
                </Card>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky bottom action bar */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.sand, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {/* Platform enquiry */}
          <TouchableOpacity onPress={handleEnquire} disabled={contacting} activeOpacity={0.8}
            style={{ flex: 1, backgroundColor: C.ink, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ color: C.white, fontWeight: '600', fontSize: 13 }}>📩 Enquire</Text>
          </TouchableOpacity>

          {/* WhatsApp */}
          <TouchableOpacity onPress={handleWhatsApp} disabled={contacting} activeOpacity={0.8}
            style={{ flex: 1.4, backgroundColor: C.wa, borderRadius: 12, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            <Text style={{ color: C.white, fontWeight: '700', fontSize: 13 }}>💬 Chat on WhatsApp</Text>
          </TouchableOpacity>
        </View>

        {/* Short-stay: open the web app to complete the reservation */}
        {isShortStay && property.seller?.booking_enabled && (
          <TouchableOpacity
            onPress={() => Linking.openURL(`${WEB_URL}/properties/${id}`)}
            activeOpacity={0.8}
            style={{ backgroundColor: C.gold, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 }}>
            <Text style={{ color: C.white, fontWeight: '700', fontSize: 13 }}>🌐 Continue on Website</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}
