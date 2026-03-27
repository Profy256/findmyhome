import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '@/lib/store'
import { authApi } from '@/lib/api'
import { C } from '@/lib/utils'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Badge, KycBanner, Divider } from '@/components/ui'
import Toast from 'react-native-toast-message'

export default function ProfileScreen() {
  const { user, clearAuth, isSeller, isAdmin } = useAuthStore()
  const insets = useSafeAreaInsets()

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
          try { await authApi.logout() } catch {}
          await clearAuth()
          router.replace('/(auth)/login')
          Toast.show({ type: 'success', text1: 'Signed out successfully.' })
        }
      },
    ])
  }

  if (!user) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper }}>
        <Text style={{ fontSize: 16, color: C.stone, marginBottom: 20 }}>You are not signed in</Text>
        <TouchableOpacity onPress={() => router.push('/(auth)/login')}
          style={{ backgroundColor: C.ink, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12 }}>
          <Text style={{ color: C.white, fontWeight: '600', fontSize: 14 }}>Sign In</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const kycColor = user.kyc_status === 'verified' ? C.forest : user.kyc_status === 'pending' ? '#b7791f' : C.red

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.paper }}
      contentContainerStyle={{ paddingTop: insets.top + 20 }}
      showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={{ backgroundColor: C.ink, paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8, alignItems: 'center' }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          <Text style={{ fontSize: 28, fontWeight: '600', color: C.white }}>{initials}</Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: '500', color: C.white, textAlign: 'center' }}>
          {user.company_name ?? user.name}
          {user.blue_badge ? '  🔵' : ''}
        </Text>
        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>{user.email}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100 }}>
            <Text style={{ fontSize: 11, color: C.white, fontWeight: '600', textTransform: 'capitalize' }}>{user.role}</Text>
          </View>
          <View style={{ backgroundColor: kycColor + '25', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100, borderWidth: 1, borderColor: kycColor + '50' }}>
            <Text style={{ fontSize: 11, color: kycColor, fontWeight: '600', textTransform: 'capitalize' }}>
              {user.kyc_status === 'verified' ? '✓ Verified' : user.kyc_status === 'pending' ? '⏳ Pending' : user.kyc_status === 'none' ? 'Not Verified' : user.kyc_status}
            </Text>
          </View>
        </View>
        {(user.average_rating ?? 0) > 0 && (
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 10 }}>
            ⭐ {user.average_rating} · {user.total_reviews} reviews
          </Text>
        )}
      </View>

      <View style={{ padding: 16 }}>
        {/* KYC banner */}
        {isSeller() && user.kyc_status !== 'verified' && (
          <KycBanner status={user.kyc_status} onPress={() => router.push('/dashboard/kyc')} />
        )}

        {/* Seller categories */}
        {isSeller() && user.seller_categories && user.seller_categories.length > 0 && (
          <View style={{ backgroundColor: C.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.sand, marginBottom: 14 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: C.dust, marginBottom: 10 }}>
              My Categories
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {user.seller_categories.map((cat: string) => (
                <View key={cat} style={{ backgroundColor: C.cream, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, borderWidth: 1, borderColor: C.sand }}>
                  <Text style={{ fontSize: 12, color: C.ink, textTransform: 'capitalize' }}>{cat.replace('_', ' ')}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Menu items */}
        {[
          isSeller() && { emoji: '📋', label: 'My Listings',   route: '/dashboard/listings' },
          isSeller() && { emoji: '📩', label: 'My Leads',      route: '/dashboard/leads' },
          isSeller() && { emoji: '📅', label: 'Bookings',      route: '/dashboard/bookings' },
          isSeller() && { emoji: '💰', label: 'Commissions',   route: '/dashboard/commissions' },
          isSeller() && { emoji: '🪪', label: 'KYC Documents', route: '/dashboard/kyc' },
          !isSeller() && { emoji: '📅', label: 'My Bookings',  route: '/dashboard/bookings' },
          { emoji: '🔔', label: 'Notifications',               route: '/dashboard/notifications' },
          isAdmin() && { emoji: '🛡️', label: 'Admin Panel',   route: '/admin' },
        ].filter(Boolean).map((item: any, i, arr) => (
          <View key={item.label}>
            <TouchableOpacity onPress={() => router.push(item.route)} activeOpacity={0.8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.white, borderRadius: 14, padding: 16, marginBottom: 2, borderWidth: 1, borderColor: C.sand }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
              </View>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '500', color: C.ink }}>{item.label}</Text>
              <Text style={{ color: C.dust, fontSize: 18 }}>›</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Sign out */}
        <TouchableOpacity onPress={handleLogout} activeOpacity={0.8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff5f5', borderRadius: 14, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#fed7d7' }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff5f5', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 18 }}>🚪</Text>
          </View>
          <Text style={{ flex: 1, fontSize: 14, fontWeight: '500', color: C.red }}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={{ fontSize: 11, color: C.dust, textAlign: 'center', marginTop: 20, marginBottom: 8 }}>
          Find My Home · Uganda Real Estate · v1.0.0
        </Text>
      </View>
    </ScrollView>
  )
}
