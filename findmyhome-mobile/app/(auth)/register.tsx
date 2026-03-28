import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native'
import { router } from 'expo-router'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { Btn, Input } from '@/components/ui'
import { C, SELLER_CATEGORIES } from '@/lib/utils'
import Toast from 'react-native-toast-message'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import axios from 'axios'

const ROLES = [
  { value: 'buyer',   label: 'Buyer',   desc: 'Looking for property',  emoji: '🔍' },
  { value: 'seller',  label: 'Seller',  desc: 'Individual owner',      emoji: '🏠' },
  { value: 'company', label: 'Company', desc: 'Real estate company',   emoji: '🏢' },
]

const THRESHOLD: Record<string, number> = { land: 95, apartment: 90, house: 90, rental: 80, airbnb: 80, lodge: 80 }

export default function RegisterScreen() {
  const [role,        setRole]        = useState('buyer')
  const [name,        setName]        = useState('')
  const [company,     setCompany]     = useState('')
  const [email,       setEmail]       = useState('')
  const [phone,       setPhone]       = useState('')
  const [password,    setPassword]    = useState('')
  const [categories,  setCategories]  = useState<string[]>([])
  const [document,    setDocument]    = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [loading,     setLoading]     = useState(false)
  const { setAuth } = useAuthStore()
  const isSeller = role === 'seller' || role === 'company'

  const CLOUD = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME
  const PRESET= process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET

  const strictest = categories.length > 0 ? Math.max(...categories.map(c => THRESHOLD[c] ?? 80)) : null

  const toggle = (key: string) =>
    setCategories(prev => prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key])

  const pickDocument = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    })
    if (!result.canceled) setDocument(result.assets[0])
  }

  const handleRegister = async () => {
    if (!name || !email || !phone || !password) {
      Toast.show({ type: 'error', text1: 'Fill in all required fields.' }); return
    }
    if (isSeller && categories.length === 0) {
      Toast.show({ type: 'error', text1: 'Select at least one property category.' }); return
    }
    if (role === 'company' && !company) {
      Toast.show({ type: 'error', text1: 'Enter your company name.' }); return
    }
    if (isSeller && !document) {
      Toast.show({ type: 'error', text1: role === 'company' ? 'Please upload your Business Registration Document.' : 'Please upload your National ID.' }); return
    }

    setLoading(true)
    try {
      let file_url = undefined
      let cloudinary_public_id = undefined

      if (isSeller && document) {
        const formData = new FormData() as any
        formData.append('file', {
          uri: document.uri,
          type: 'image/jpeg',
          name: 'upload.jpg',
        })
        formData.append('upload_preset', PRESET ?? 'findmyhome_kyc')
        formData.append('folder', 'kyc')

        const resCld = await axios.post(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        file_url = resCld.data.secure_url
        cloudinary_public_id = resCld.data.public_id
      }

      const payload = { 
        name, email, phone, password, role, 
        company_name: company || undefined, 
        seller_categories: isSeller ? categories : undefined,
        file_url, cloudinary_public_id
      }
      const res = await authApi.register(payload)
      await setAuth(res.data.user, res.data.token)
      Toast.show({ type: 'success', text1: 'Account created!', text2: isSeller ? 'Your verification is being processed.' : 'Start browsing properties.' })
      router.replace('/(tabs)')
    } catch (err: any) {
      const errs = err.response?.data?.errors
      if (errs) { Toast.show({ type: 'error', text1: Object.values(errs).flat()[0] as string }) }
      else { Toast.show({ type: 'error', text1: err.response?.data?.message ?? 'Registration failed.' }) }
    } finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1, backgroundColor: C.paper }} contentContainerStyle={{ padding: 24, paddingTop: 60 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 13, color: C.stone }}>← Back</Text>
        </TouchableOpacity>

        <Text style={{ fontSize: 28, fontWeight: '300', color: C.ink, marginBottom: 4 }}>Create account</Text>
        <Text style={{ fontSize: 14, color: C.stone, marginBottom: 28 }}>Join Find My Home</Text>

        {/* Role selector */}
        <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: C.dust, marginBottom: 10 }}>I am a</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
          {ROLES.map(r => (
            <TouchableOpacity key={r.value} onPress={() => setRole(r.value)} activeOpacity={0.8}
              style={{ flex: 1, padding: 14, borderRadius: 14, borderWidth: 2,
                borderColor: role === r.value ? C.ink : C.sand,
                backgroundColor: role === r.value ? C.white : C.paper }}>
              <Text style={{ fontSize: 20, marginBottom: 6 }}>{r.emoji}</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: role === r.value ? C.ink : C.stone }}>{r.label}</Text>
              <Text style={{ fontSize: 10, color: C.dust, marginTop: 2 }}>{r.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {role === 'company' && (
          <Input label="Company Name *" placeholder="e.g. Prime Estates Uganda"
            value={company} onChangeText={setCompany} />
        )}
        <Input label="Full Name *" placeholder="Your legal full name" value={name} onChangeText={setName} />
        <Input label="Email *" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <Input label="Phone *" placeholder="+256 7XX XXX XXX" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Input label="Password *" placeholder="At least 8 characters" value={password} onChangeText={setPassword} secureTextEntry />

        {/* Category selector */}
        {isSeller && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: C.ink, marginBottom: 6 }}>
              What will you list? <Text style={{ color: C.red }}>*</Text>
            </Text>
            <Text style={{ fontSize: 12, color: C.stone, marginBottom: 14, lineHeight: 18 }}>
              Select all that apply. KYC is assessed at the strictest level you choose.
            </Text>
            {SELLER_CATEGORIES.map(cat => {
              const selected = categories.includes(cat.key)
              const strictColor = cat.threshold >= 95 ? '#e53e3e' : cat.threshold >= 90 ? '#b7791f' : '#276749'
              return (
                <TouchableOpacity key={cat.key} onPress={() => toggle(cat.key)} activeOpacity={0.8}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
                    borderRadius: 14, borderWidth: 2, borderColor: selected ? C.ink : C.sand,
                    backgroundColor: selected ? C.white : C.paper, marginBottom: 8 }}>
                  <Text style={{ fontSize: 22 }}>{cat.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: selected ? C.ink : C.stone }}>{cat.label}</Text>
                      <View style={{ backgroundColor: strictColor + '15', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 9, fontWeight: '700', color: strictColor, textTransform: 'uppercase' }}>{cat.strictness}</Text>
                      </View>
                    </View>
                  </View>
                  {selected && <Text style={{ fontSize: 18, color: C.ink }}>✓</Text>}
                </TouchableOpacity>
              )
            })}

            {strictest !== null && (
              <View style={{ padding: 14, borderRadius: 12, backgroundColor: strictest >= 95 ? '#fff5f5' : strictest >= 90 ? '#fffbeb' : '#f0fff4', marginTop: 8 }}>
                <Text style={{ fontSize: 12, color: strictest >= 95 ? '#c53030' : strictest >= 90 ? '#b7791f' : '#276749', lineHeight: 18 }}>
                  {strictest >= 95
                    ? '⚠️ Land selected — very strict. Upload a clear National ID. A land title is required for every land listing.'
                    : strictest >= 90
                    ? '📋 Apartments selected — moderate strictness. Clear National ID required.'
                    : '✅ Light verification. A clear National ID is all you need.'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Document Upload */}
        {isSeller && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: C.ink, marginBottom: 6 }}>
              {role === 'company' ? 'Business Document' : 'National ID'} <Text style={{ color: C.red }}>*</Text>
            </Text>
            <Text style={{ fontSize: 12, color: C.stone, marginBottom: 14, lineHeight: 18 }}>
              {role === 'company' ? 'Upload your Business Registration Certificate for instant verification.' : 'Upload a clear photo of your National ID or Passport for instant verification.'}
            </Text>

            <TouchableOpacity
              onPress={pickDocument}
              style={{
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: document ? '#48bb78' : C.sand,
                backgroundColor: document ? '#f0fff4' : C.paper,
                borderRadius: 14,
                padding: 24,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 24, marginBottom: 8 }}>{document ? '✅' : '📷'}</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: document ? '#276749' : C.ink }}>
                {document ? 'Document Selected' : 'Tap to select document'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <Btn label="Create Account" onPress={handleRegister} loading={loading} style={{ marginBottom: 16 }} />

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, paddingBottom: 40 }}>
          <Text style={{ fontSize: 14, color: C.stone }}>Already have an account?</Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: C.ink }}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
