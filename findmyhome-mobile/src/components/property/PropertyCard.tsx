import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { C, formatUGX } from '@/lib/utils'

interface Property {
  id: string; title: string; location: string; price: number
  property_type: string; listing_type: string
  bedrooms?: number; bathrooms?: number; size?: string
  photos?: string[]; status: string; featured?: boolean
  trust_label?: string; land_title_verified?: boolean
  seller?: { id: string; display_name: string; blue_badge: boolean; average_rating: number; role: string }
}

const EMOJI: Record<string, string> = {
  house: '🏡',
  apartment: '🏢',
  land: '🌿',
  rental: '🏠',
  airbnb: '🏖️',
  lodge: '🏨',
}

export function PropertyCard({ property, onPress }: { property: Property; onPress: () => void }) {
  const emoji = EMOJI[property.property_type] ?? '🏠'

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.92}
      style={{ backgroundColor: C.white, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.sand, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 }}>

      {/* Image */}
      <View style={{ height: 180, backgroundColor: '#1a2a3a', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {property.photos?.[0] ? (
          <Image source={{ uri: property.photos[0] }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <Text style={{ fontSize: 52 }}>{emoji}</Text>
        )}

        {/* Top badges */}
        <View style={{ position: 'absolute', top: 10, left: 10, flexDirection: 'row', gap: 6 }}>
          <View style={{ backgroundColor: property.listing_type === 'sale' ? 'rgba(28,28,26,0.85)' : 'rgba(45,74,62,0.9)', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {property.listing_type === 'sale' ? 'For Sale' : property.listing_type === 'short_stay' ? 'Short Stay' : 'For Rent'}
            </Text>
          </View>
          {property.featured && (
            <View style={{ backgroundColor: 'rgba(184,150,90,0.95)', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>★ Featured</Text>
            </View>
          )}
          {property.land_title_verified && (
            <View style={{ backgroundColor: 'rgba(45,74,62,0.9)', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>📜 Titled</Text>
            </View>
          )}
        </View>
      </View>

      {/* Body */}
      <View style={{ padding: 14 }}>
        <Text style={{ fontSize: 18, fontWeight: '300', color: C.ink, letterSpacing: -0.3 }}>
          {formatUGX(property.price)}
          {property.listing_type === 'rent' && <Text style={{ fontSize: 11, color: C.dust }}> /mo</Text>}
          {property.listing_type === 'short_stay' && <Text style={{ fontSize: 11, color: C.dust }}> /night</Text>}
        </Text>
        <Text style={{ fontSize: 14, fontWeight: '500', color: C.ink, marginTop: 2, marginBottom: 6 }} numberOfLines={1}>{property.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.gold }} />
          <Text style={{ fontSize: 12, color: C.stone }} numberOfLines={1}>{property.location}</Text>
        </View>

        {/* Specs */}
        {(property.bedrooms || property.bathrooms || property.size) && (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.sand }}>
            {property.bedrooms  && <Text style={{ fontSize: 11, color: C.stone }}>🛏 {property.bedrooms} bed</Text>}
            {property.bathrooms && <Text style={{ fontSize: 11, color: C.stone }}>🚿 {property.bathrooms} bath</Text>}
            {property.size      && <Text style={{ fontSize: 11, color: C.stone }}>📐 {property.size}</Text>}
          </View>
        )}
      </View>

      {/* Footer */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.cream }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: C.white, fontSize: 10, fontWeight: '600' }}>{property.seller?.display_name?.[0]}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 11, fontWeight: '500', color: C.ink }}>
              {property.seller?.display_name}
              {property.seller?.blue_badge ? ' 🔵' : ''}
            </Text>
            <Text style={{ fontSize: 9, color: C.forest, fontWeight: '700' }}>{property.trust_label ?? '✓ Verified'}</Text>
          </View>
        </View>
        {(property.seller?.average_rating ?? 0) > 0 && (
          <Text style={{ fontSize: 11, color: C.stone }}>⭐ {property.seller?.average_rating}</Text>
        )}
      </View>
    </TouchableOpacity>
  )
}
