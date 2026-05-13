import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { propertiesApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { C, PROPERTY_TYPES, SELLER_CATEGORIES } from '@/lib/utils'
import { Btn, Input, Loading } from '@/components/ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'

export default function NewListingScreen() {
  const { user }   = useAuthStore()
  const insets     = useSafeAreaInsets()

  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [price,       setPrice]       = useState('')
  const [location,    setLocation]    = useState('')
  const [district,    setDistrict]    = useState('')
  const [propType,    setPropType]    = useState('house')

  // Filter types to only what the seller is registered for
  const allowedTypes = user?.role === 'company'
    ? PROPERTY_TYPES
    : PROPERTY_TYPES.filter(t => (user?.seller_categories ?? []).includes(t.key))
  const [bedrooms,    setBedrooms]    = useState('')
  const [bathrooms,   setBathrooms]   = useState('')
  const [size,        setSize]        = useState('')
  const [maxGuests,   setMaxGuests]   = useState('')
  const [photos,      setPhotos]      = useState<string[]>([])
  const [titleUrl,    setTitleUrl]    = useState('')
  const [titleLat,    setTitleLat]    = useState('')
  const [titleLng,    setTitleLng]    = useState('')
  const [uploading,   setUploading]   = useState(false)
  const [submitting,  setSubmitting]  = useState(false)

  const isLand      = propType === 'land'
  const isShortStay = propType === 'airbnb' || propType === 'lodge'
  const needsTitle  = isLand && user?.role === 'seller'

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, quality: 0.8 })
    if (result.canceled) return
    setUploading(true)
    try {
      const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME
      const preset    = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? 'findmyhome_unsigned'
      const urls: string[] = []
      for (const asset of result.assets) {
        const formData = new FormData()
        formData.append('file', { uri: asset.uri, type: 'image/jpeg', name: 'photo.jpg' } as any)
        formData.append('upload_preset', preset)
        formData.append('folder', 'properties')
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: formData })
        const data = await res.json()
        if (data.secure_url) urls.push(data.secure_url)
      }
      setPhotos(prev => [...prev, ...urls])
    } catch { Toast.show({ type: 'error', text1: 'Photo upload failed.' }) }
    finally { setUploading(false) }
  }

  const handleSubmit = async () => {
    if (!title || !description || !price || !location) {
      Toast.show({ type: 'error', text1: 'Fill in all required fields.' }); return
    }
    if (photos.length === 0) {
      Toast.show({ type: 'error', text1: 'Upload at least one photo.' }); return
    }
    if (needsTitle && !titleUrl) {
      Toast.show({ type: 'error', text1: 'Land sellers must upload a land title.' }); return
    }

    setSubmitting(true)
    try {
      const payload: Record<string, any> = {
        title, description, price: parseInt(price), location, district,
        property_type: propType, photos,
        bedrooms:  bedrooms  ? parseInt(bedrooms)  : undefined,
        bathrooms: bathrooms ? parseInt(bathrooms) : undefined,
        size:      size || undefined,
        max_guests: maxGuests ? parseInt(maxGuests) : undefined,
      }
      if (needsTitle && titleUrl) {
        payload.land_title_url = titleUrl
        if (titleLat) payload.land_title_lat = parseFloat(titleLat)
        if (titleLng) payload.land_title_lng = parseFloat(titleLng)
      }
      await propertiesApi.create(payload)
      Toast.show({ type: 'success', text1: 'Listing created!', text2: 'Your property is now live.' })
      router.replace('/dashboard/listings')
    } catch (err: any) {
      const msg = err.response?.data?.message ?? 'Failed to create listing.'
      Toast.show({ type: 'error', text1: msg })
    } finally { setSubmitting(false) }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1, backgroundColor: C.paper }}
        contentContainerStyle={{ paddingTop: insets.top + 16, padding: 20, paddingBottom: 60 }}>

        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 13, color: C.stone }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 9, fontWeight: '700', color: C.gold, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>Seller</Text>
        <Text style={{ fontSize: 26, fontWeight: '300', color: C.ink, marginBottom: 24 }}>New Listing</Text>

        {/* Property type */}
        <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: C.dust, marginBottom: 10 }}>Property Type *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {allowedTypes.map(t => (
              <TouchableOpacity key={t.key} onPress={() => setPropType(t.key)} activeOpacity={0.8}
                style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 2,
                  borderColor: propType===t.key ? C.ink : C.sand, backgroundColor: propType===t.key ? C.ink : C.white,
                  flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 16 }}>{t.emoji}</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: propType===t.key ? C.white : C.stone }}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <Input label="Title *" placeholder="e.g. 3 Bedroom House — Kira Road" value={title} onChangeText={setTitle} />
        <Input label="Description *" placeholder="Describe the property in detail..." value={description} onChangeText={setDescription} multiline numberOfLines={4} />
        <Input label="Price (UGX) *" placeholder={isShortStay ? 'Price per night' : isLand ? 'Sale price' : 'Monthly rent'} value={price} onChangeText={setPrice} keyboardType="numeric" />
        <Input label="Location *" placeholder="Area / address" value={location} onChangeText={setLocation} />
        <Input label="District" placeholder="e.g. Kampala, Wakiso" value={district} onChangeText={setDistrict} />

        {!isLand && !isShortStay && (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}><Input label="Bedrooms" placeholder="0" value={bedrooms} onChangeText={setBedrooms} keyboardType="numeric" /></View>
            <View style={{ flex: 1 }}><Input label="Bathrooms" placeholder="0" value={bathrooms} onChangeText={setBathrooms} keyboardType="numeric" /></View>
          </View>
        )}
        {isLand && <Input label="Plot Size" placeholder="e.g. 50 decimals" value={size} onChangeText={setSize} />}
        {isShortStay && <Input label="Max Guests" placeholder="e.g. 4" value={maxGuests} onChangeText={setMaxGuests} keyboardType="numeric" />}

        {/* Photos */}
        <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: C.dust, marginBottom: 10 }}>Photos *</Text>
        <TouchableOpacity onPress={pickPhoto} disabled={uploading} activeOpacity={0.8}
          style={{ backgroundColor: C.cream, borderRadius: 14, borderWidth: 2, borderColor: C.sand, borderStyle: 'dashed', padding: 20, alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ fontSize: 28, marginBottom: 6 }}>📷</Text>
          <Text style={{ fontSize: 13, fontWeight: '600', color: C.ink }}>{uploading ? 'Uploading...' : 'Add Photos'}</Text>
          <Text style={{ fontSize: 11, color: C.dust, marginTop: 2 }}>{photos.length} photo(s) uploaded</Text>
        </TouchableOpacity>

        {/* Land title section */}
        {isLand && (
          <View style={{ backgroundColor: needsTitle ? '#fffbeb' : '#f0fff4', borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: needsTitle ? '#f6e05e' : '#9ae6b4' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink, marginBottom: 4 }}>
              {needsTitle ? '⚠️ Land Title Required' : '✅ Land Title (Optional)'}
            </Text>
            <Text style={{ fontSize: 12, color: C.stone, marginBottom: 14, lineHeight: 18 }}>
              {needsTitle
                ? 'As an individual seller, you must upload a land title document. This protects buyers from fraud. Companies are exempt.'
                : 'As a company, uploading a land title is optional but increases buyer trust.'}
            </Text>
            <Input label="Title Document URL" placeholder="Cloudinary URL after upload" value={titleUrl} onChangeText={setTitleUrl} />
            <Input label="Latitude (from land title)" placeholder="e.g. 0.3127" value={titleLat} onChangeText={setTitleLat} keyboardType="numeric" />
            <Input label="Longitude (from land title)" placeholder="e.g. 32.4951" value={titleLng} onChangeText={setTitleLng} keyboardType="numeric" />
            <Text style={{ fontSize: 11, color: C.stone, lineHeight: 17 }}>
              💡 The coordinates on your Ugandan land title are Google Maps coordinates. Copy them directly from your title document.
            </Text>
          </View>
        )}

        <Btn label={submitting ? 'Publishing...' : 'Publish Listing'} onPress={handleSubmit} loading={submitting} variant="gold" size="lg" />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
