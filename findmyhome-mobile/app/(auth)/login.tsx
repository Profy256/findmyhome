import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native'
import { router } from 'expo-router'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { Btn, Input } from '@/components/ui'
import { C } from '@/lib/utils'
import Toast from 'react-native-toast-message'

export default function LoginScreen() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const { setAuth } = useAuthStore()

  const handleLogin = async () => {
    if (!email || !password) { Toast.show({ type: 'error', text1: 'Fill in all fields.' }); return }
    setLoading(true)
    try {
      const res = await authApi.login({ email, password })
      await setAuth(res.data.user, res.data.token)
      Toast.show({ type: 'success', text1: `Welcome back, ${res.data.user.name.split(' ')[0]}!` })
      router.replace('/(tabs)')
    } catch (err: any) {
      const msg = err.response?.data?.errors?.email?.[0] ?? err.response?.data?.message ?? 'Login failed.'
      Toast.show({ type: 'error', text1: msg })
    } finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1, backgroundColor: C.paper }} contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View style={{ backgroundColor: C.ink, paddingTop: 80, paddingBottom: 48, paddingHorizontal: 28, alignItems: 'center' }}>
          <View style={{ width: 52, height: 52, backgroundColor: C.gold, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 24 }}>🏠</Text>
          </View>
          <Text style={{ fontSize: 36, fontWeight: '300', color: C.white, letterSpacing: -1 }}>
            Find My <Text style={{ color: C.gold2, fontStyle: 'italic' }}>Home</Text>
          </Text>
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginTop: 8, fontWeight: '300' }}>
            Uganda's Most Trusted Property Marketplace
          </Text>
        </View>

        {/* Form */}
        <View style={{ padding: 28, paddingTop: 36 }}>
          <Text style={{ fontSize: 24, fontWeight: '300', color: C.ink, marginBottom: 4 }}>Welcome back</Text>
          <Text style={{ fontSize: 14, color: C.stone, marginBottom: 28 }}>Sign in to your account</Text>

          <Input label="Email" placeholder="you@example.com" value={email}
            onChangeText={setEmail} keyboardType="email-address" />
          <Input label="Password" placeholder="Your password" value={password}
            onChangeText={setPassword} secureTextEntry />

          <Btn label="Sign In" onPress={handleLogin} loading={loading} style={{ marginTop: 8 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24, gap: 6 }}>
            <Text style={{ fontSize: 14, color: C.stone }}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: C.ink }}>Create one</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
