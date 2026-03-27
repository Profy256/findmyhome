import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { router } from 'expo-router'
import { kycApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { C } from '@/lib/utils'
import { Loading, Btn, Badge, Card } from '@/components/ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'

const DOC_TYPES = [
  { key: 'national_id',           label: 'National ID',           emoji: '🪪', desc: 'Uganda National Identity Card' },
  { key: 'passport',              label: 'Passport',              emoji: '📘', desc: 'Valid travel passport' },
  { key: 'drivers_licence',       label: "Driver's Licence",      emoji: '🚗', desc: 'Uganda driver\'s licence' },
  { key: 'business_registration', label: 'Business Registration', emoji: '📋', desc: 'Certificate of Incorporation (companies only)' },
]

export default function KycScreen() {
  const [documents, setDocuments] = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [docType,   setDocType]   = useState('national_id')
  const { user }                  = useAuthStore()
  const insets                    = useSafeAreaInsets()

  const load = async () => {
    setLoading(true)
    try { const r = await kycApi.documents(); setDocuments(r.data) }
    catch {} finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const pickAndUpload = async (useCamera = false) => {
    try {
      let result: any
      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync()
        if (!perm.granted) { Alert.alert('Permission needed', 'Camera access is required.'); return }
        result = await ImagePicker.launchCameraAsync({ quality: 0.8, base64: false })
      } else {
        result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, base64: false })
      }
      if (result.canceled) return

      setUploading(true)
      const asset = result.assets[0]

      // Upload to Cloudinary
      const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME
      const preset    = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? 'findmyhome_unsigned'
      const formData  = new FormData()
      formData.append('file', { uri: asset.uri, type: 'image/jpeg', name: 'kyc_doc.jpg' } as any)
      formData.append('upload_preset', preset)
      formData.append('folder', 'kyc')

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: formData })
      const uploadData = await uploadRes.json()

      if (!uploadData.secure_url) throw new Error('Upload failed')

      // Save to API
      await kycApi.upload({
        document_type:        docType,
        file_url:             uploadData.secure_url,
        cloudinary_public_id: uploadData.public_id,
      })

      Toast.show({ type: 'success', text1: 'Document uploaded!', text2: 'We are reviewing it now.' })
      load()
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.message ?? 'Upload failed.' })
    } finally { setUploading(false) }
  }

  const statusColor = (s: string) => s === 'verified' ? 'green' : s === 'pending' ? 'amber' : 'red'

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, padding: 20, paddingBottom: 40 }}>

        {/* Header */}
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 13, color: C.stone }}>← Back</Text>
        </TouchableOpacity>

        <Text style={{ fontSize: 9, fontWeight: '700', color: C.gold, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>Verification</Text>
        <Text style={{ fontSize: 26, fontWeight: '300', color: C.ink, marginBottom: 8 }}>KYC Documents</Text>

        {/* Current status */}
        <View style={{ backgroundColor: user?.kyc_status === 'verified' ? '#f0fff4' : '#fffbeb', borderRadius: 14, padding: 16, marginBottom: 24, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 28 }}>{user?.kyc_status === 'verified' ? '✅' : user?.kyc_status === 'pending' ? '⏳' : '📋'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: C.ink }}>
              {user?.kyc_status === 'verified' ? 'Identity Verified' : user?.kyc_status === 'pending' ? 'Under Review' : 'Verification Required'}
            </Text>
            <Text style={{ fontSize: 12, color: C.stone, marginTop: 3, lineHeight: 17 }}>
              {user?.kyc_status === 'verified'
                ? 'Your identity is verified. You can list properties.'
                : user?.kyc_status === 'pending'
                ? 'Your documents are being reviewed. Most verifications complete within minutes.'
                : 'Upload your identity document to start listing properties.'}
            </Text>
          </View>
        </View>

        {/* Requirements info */}
        {user?.role === 'company' && (
          <Card style={{ padding: 16, marginBottom: 20 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink, marginBottom: 8 }}>Company Requirements</Text>
            <Text style={{ fontSize: 12, color: C.stone, lineHeight: 18, marginBottom: 4 }}>✓ Business Registration Certificate (URSB)</Text>
            <Text style={{ fontSize: 12, color: C.stone, lineHeight: 18 }}>✓ Director's National ID or Passport</Text>
            <Text style={{ fontSize: 11, color: C.dust, marginTop: 8, lineHeight: 16 }}>Both documents must be verified before your company account is fully activated.</Text>
          </Card>
        )}

        {/* Uploaded documents */}
        {loading ? <Loading /> : documents.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: C.ink, marginBottom: 12 }}>Uploaded Documents</Text>
            {documents.map((doc: any) => (
              <Card key={doc.id} style={{ padding: 14, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Text style={{ fontSize: 22 }}>{DOC_TYPES.find(d => d.key === doc.document_type)?.emoji ?? '📄'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: C.ink }}>
                      {DOC_TYPES.find(d => d.key === doc.document_type)?.label ?? doc.document_type}
                    </Text>
                    {doc.rejection_reason && (
                      <Text style={{ fontSize: 11, color: C.red, marginTop: 3, lineHeight: 16 }}>
                        Reason: {doc.rejection_reason}
                      </Text>
                    )}
                    {doc.ai_confidence_score && (
                      <Text style={{ fontSize: 10, color: C.dust, marginTop: 2 }}>
                        AI Confidence: {doc.ai_confidence_score}%
                      </Text>
                    )}
                  </View>
                  <Badge label={doc.status} color={statusColor(doc.status) as any} />
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Upload new */}
        {user?.kyc_status !== 'verified' && (
          <View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: C.ink, marginBottom: 14 }}>Upload Document</Text>

            {/* Document type selector */}
            <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: C.dust, marginBottom: 10 }}>
              Document Type
            </Text>
            {DOC_TYPES.filter(d => user?.role === 'company' || d.key !== 'business_registration').map(d => (
              <TouchableOpacity key={d.key} onPress={() => setDocType(d.key)} activeOpacity={0.8}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14,
                  borderWidth: 2, borderColor: docType === d.key ? C.ink : C.sand,
                  backgroundColor: docType === d.key ? C.white : C.paper, marginBottom: 8 }}>
                <Text style={{ fontSize: 22 }}>{d.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: docType === d.key ? C.ink : C.stone }}>{d.label}</Text>
                  <Text style={{ fontSize: 11, color: C.dust, marginTop: 2 }}>{d.desc}</Text>
                </View>
                {docType === d.key && <Text style={{ color: C.ink, fontSize: 18 }}>✓</Text>}
              </TouchableOpacity>
            ))}

            <View style={{ marginTop: 20, gap: 10 }}>
              <Btn label="📷  Take a Photo" onPress={() => pickAndUpload(true)}  loading={uploading} variant="primary" />
              <Btn label="🖼️  Choose from Gallery" onPress={() => pickAndUpload(false)} loading={uploading} variant="outline" />
            </View>

            <View style={{ backgroundColor: '#fffbeb', borderRadius: 12, padding: 14, marginTop: 16 }}>
              <Text style={{ fontSize: 12, color: '#b7791f', lineHeight: 18 }}>
                💡 Tips for faster verification:{'\n'}
                • Ensure the document is well-lit and fully visible{'\n'}
                • All text must be clearly readable{'\n'}
                • The name on the document must match your registered name{'\n'}
                • Document must not be expired
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
