import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native'
import { router } from 'expo-router'
import { leadsApi, propertiesApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { C, formatUGX, timeAgo } from '@/lib/utils'
import { KycBanner, Loading, StatCard, Empty, Card, Divider } from '@/components/ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function DashboardScreen() {
  const { user, isSeller, isBuyer, clearAuth } = useAuthStore()
  const [leads,     setLeads]     = useState<any>(null)
  const [listings,  setListings]  = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [refreshing,setRefreshing]= useState(false)
  const insets = useSafeAreaInsets()

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      if (isSeller()) {
        const [l, p] = await Promise.all([leadsApi.mine(), propertiesApi.mine()])
        setLeads(l.data.summary)
        setListings(p.data.data?.slice(0, 3) ?? [])
      }
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { load() }, [])

  if (loading) return <Loading full />

  if (!user) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper, paddingHorizontal: 20 }}>
        <Text style={{ fontSize: 16, color: C.stone, marginBottom: 20, textAlign: 'center' }}>You must be signed in to view your dashboard</Text>
        <TouchableOpacity onPress={() => router.push('/(auth)/login')} activeOpacity={0.8}
          style={{ backgroundColor: C.ink, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12 }}>
          <Text style={{ color: C.white, fontWeight: '600', fontSize: 14 }}>Sign In</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // Buyer dashboard
  if (isBuyer()) return (
    <ScrollView style={{ flex: 1, backgroundColor: C.paper }} contentContainerStyle={{ paddingTop: insets.top + 20, padding: 20 }}>
      <Text style={{ fontSize: 9, fontWeight: '700', color: C.gold, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>Your Account</Text>
      <Text style={{ fontSize: 26, fontWeight: '300', color: C.ink, marginBottom: 24 }}>Hello, {user?.name.split(' ')[0]} 👋</Text>
      {[
        { emoji: '🔍', label: 'Browse Properties', desc: 'Find your perfect property', route: '/(tabs)/search' },
        { emoji: '🏠', label: 'Saved Properties',  desc: 'Your saved listings', route: '/(tabs)/search' },
        { emoji: '📅', label: 'My Bookings',       desc: 'Your rental bookings', route: '/dashboard/bookings' },
        { emoji: '🔔', label: 'Notifications',     desc: 'Updates and alerts', route: '/dashboard/notifications' },
      ].map(item => (
        <TouchableOpacity key={item.label} onPress={() => router.push(item.route as any)} activeOpacity={0.8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.white, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.sand }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: C.ink }}>{item.label}</Text>
            <Text style={{ fontSize: 12, color: C.stone, marginTop: 2 }}>{item.desc}</Text>
          </View>
          <Text style={{ color: C.dust, fontSize: 18 }}>›</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )

  // Seller dashboard
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.paper }}
      contentContainerStyle={{ paddingTop: insets.top + 20, padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.gold} />}>

      <Text style={{ fontSize: 9, fontWeight: '700', color: C.gold, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>Seller Dashboard</Text>
      <Text style={{ fontSize: 26, fontWeight: '300', color: C.ink, marginBottom: 20 }}>
        {user?.company_name ?? user?.name.split(' ')[0]} {user?.blue_badge ? '🔵' : ''}
      </Text>

      {/* KYC Banner */}
      <KycBanner status={user?.kyc_status ?? 'none'} onPress={() => router.push('/dashboard/kyc')} />

      {/* Stats */}
      {leads && (
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          <StatCard label="Total Leads" value={leads.total} />
          <StatCard label="WhatsApp"    value={leads.whatsapp} color={C.forest} />
          <StatCard label="Today"       value={leads.today}   color={C.gold} />
        </View>
      )}

      {/* Quick actions */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        {[
          { emoji: '➕', label: 'New Listing',   route: '/dashboard/new-listing' },
          { emoji: '📋', label: 'My Listings',   route: '/dashboard/listings' },
          { emoji: '📩', label: 'Leads',         route: '/dashboard/leads' },
          { emoji: '📅', label: 'Bookings',      route: '/dashboard/bookings' },
          { emoji: '🧾', label: 'Invoices',       route: '/dashboard/commissions' },
          { emoji: '🪪', label: 'KYC',           route: '/dashboard/kyc' },
        ].map(a => (
          <TouchableOpacity key={a.label} onPress={() => router.push(a.route as any)} activeOpacity={0.8}
            style={{ width: '30%', backgroundColor: C.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.sand, alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 24 }}>{a.emoji}</Text>
            <Text style={{ fontSize: 11, fontWeight: '600', color: C.ink, textAlign: 'center' }}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recent listings */}
      {listings.length > 0 && (
        <Card>
          <View style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: C.ink }}>Recent Listings</Text>
              <TouchableOpacity onPress={() => router.push('/dashboard/listings' as any)}>
                <Text style={{ fontSize: 12, color: C.gold }}>See all →</Text>
              </TouchableOpacity>
            </View>
            {listings.map((l, i) => (
              <View key={l.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 18 }}>🏠</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '500', color: C.ink }} numberOfLines={1}>{l.title}</Text>
                    <Text style={{ fontSize: 11, color: C.stone }}>{formatUGX(l.price)} · {l.status}</Text>
                  </View>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: l.status === 'active' ? '#48BB78' : C.dust }} />
                </View>
                {i < listings.length - 1 && <Divider />}
              </View>
            ))}
          </View>
        </Card>
      )}
    </ScrollView>
  )
}
