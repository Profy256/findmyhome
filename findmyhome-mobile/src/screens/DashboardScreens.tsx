// ── LEADS SCREEN ──────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, FlatList, Linking, RefreshControl } from 'react-native'
import { router } from 'expo-router'
import { leadsApi, bookingsApi, transactionsApi, notificationsApi, propertiesApi } from '@/lib/api'
import { C, formatUGX, timeAgo } from '@/lib/utils'
import { Loading, Empty, StatCard, Badge, Card, Divider } from '@/components/ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'

const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://findmyhomeuganda.com').replace(/\/$/, '')

function ScreenHeader({ title, label, onBack }: { title: string; label?: string; onBack?: () => void }) {
  const insets = useSafeAreaInsets()
  return (
    <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.sand }}>
      {onBack && <TouchableOpacity onPress={onBack} style={{ marginBottom: 12 }}><Text style={{ fontSize: 13, color: C.stone }}>← Back</Text></TouchableOpacity>}
      {label && <Text style={{ fontSize: 9, fontWeight: '700', color: C.gold, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>{label}</Text>}
      <Text style={{ fontSize: 26, fontWeight: '300', color: C.ink }}>{title}</Text>
    </View>
  )
}

export function LeadsScreen() {
  const [data,      setData]      = useState<any>(null)
  const [loading,   setLoading]   = useState(true)
  const [refreshing,setRefreshing]= useState(false)
  const [method,    setMethod]    = useState('')

  const load = async (refresh = false) => {
    if (!refresh) setLoading(true)
    try { const r = await leadsApi.mine({ contact_method: method||undefined }); setData(r.data) }
    catch {} finally { setLoading(false); setRefreshing(false) }
  }
  useEffect(() => { load() }, [method])

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <ScreenHeader title="My Leads" label="Activity" onBack={() => router.back()} />
      {data?.summary && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ padding: 16, maxHeight: 90 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatCard label="Total"    value={data.summary.total} />
            <StatCard label="WhatsApp" value={data.summary.whatsapp} color={C.forest} />
            <StatCard label="Platform" value={data.summary.platform} />
            <StatCard label="Today"    value={data.summary.today} color={C.gold} />
          </View>
        </ScrollView>
      )}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}>
        {[['','All'],['whatsapp','💬 WhatsApp'],['platform','📩 Platform']].map(([v,l]) => (
          <TouchableOpacity key={v} onPress={() => setMethod(v)}
            style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, backgroundColor: method===v?C.ink:C.white, borderWidth: 1, borderColor: method===v?C.ink:C.sand }}>
            <Text style={{ fontSize: 12, color: method===v?C.white:C.stone, fontWeight: method===v?'600':'400' }}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? <Loading /> : !data?.leads?.data?.length ? (
        <Empty emoji="📭" title="No leads yet" description="When buyers contact you through Find My Home, their leads appear here." />
      ) : (
        <FlatList
          data={data.leads.data}
          keyExtractor={(i: any) => i.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true) }} tintColor={C.gold} />}
          renderItem={({ item: lead }: { item: any }) => (
            <Card style={{ marginBottom: 12 }}>
              <View style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: C.ink }}>{lead.buyer?.name}</Text>
                    <Text style={{ fontSize: 12, color: C.stone, marginTop: 2 }}>📞 {lead.buyer?.phone}</Text>
                  </View>
                  <Badge label={lead.contact_method === 'whatsapp' ? '💬 WhatsApp' : '📩 Platform'}
                    color={lead.contact_method === 'whatsapp' ? 'green' : 'blue'} />
                </View>
                <Divider />
                <Text style={{ fontSize: 12, color: C.stone }} numberOfLines={1}>🏠 {lead.property?.title}</Text>
                <Text style={{ fontSize: 11, color: C.dust, marginTop: 4 }}>{timeAgo(lead.created_at)}</Text>
                {lead.contact_method === 'whatsapp' && (
                  <TouchableOpacity onPress={() => Linking.openURL(`https://wa.me/${lead.buyer?.phone?.replace(/\D/g,'')}`)}
                    style={{ marginTop: 10, backgroundColor: C.wa, borderRadius: 8, paddingVertical: 9, alignItems: 'center' }}>
                    <Text style={{ color: C.white, fontWeight: '700', fontSize: 13 }}>Open WhatsApp →</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Card>
          )}
        />
      )}
    </View>
  )
}

export function BookingsScreen() {
  const [data,    setData]    = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [acting,  setActing]  = useState<string|null>(null)

  const load = async () => {
    setLoading(true)
    try { const r = await bookingsApi.mine(); setData(r.data.data ?? r.data) }
    catch {} finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const updateStatus = async (id: string, status: 'confirmed'|'rejected') => {
    setActing(id)
    try {
      await bookingsApi.updateStatus(id, { status })
      Toast.show({ type: 'success', text1: `Booking ${status}.` })
      load()
    } catch { Toast.show({ type: 'error', text1: 'Failed.' }) }
    finally { setActing(null) }
  }

  const statusColor = (s: string) => s==='confirmed'?'green':s==='rejected'||s==='cancelled'?'red':s==='completed'?'blue':'amber'

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <ScreenHeader title="Bookings" label="Rentals" onBack={() => router.back()} />
      {loading ? <Loading /> : !data.length ? (
        <Empty emoji="📅" title="No bookings yet" description="Online bookings for your rental properties will appear here." />
      ) : (
        <FlatList data={data} keyExtractor={(i: any) => i.id} contentContainerStyle={{ padding: 16 }}
          renderItem={({ item: b }: { item: any }) => (
            <Card style={{ marginBottom: 12, padding: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: C.ink }}>{b.buyer?.name}</Text>
                <Badge label={b.status} color={statusColor(b.status) as any} />
              </View>
              <Text style={{ fontSize: 13, color: C.stone }} numberOfLines={1}>🏠 {b.property?.title}</Text>
              <Text style={{ fontSize: 12, color: C.stone, marginTop: 4 }}>📅 {b.checkin_date} → {b.checkout_date}</Text>
              <Text style={{ fontSize: 12, color: C.stone, marginTop: 2 }}>👥 {b.guests} guests · {b.nights} nights</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: C.ink, marginTop: 8 }}>{formatUGX(b.total_price)}</Text>
              {b.status === 'pending' && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <TouchableOpacity onPress={() => updateStatus(b.id, 'confirmed')} disabled={acting===b.id}
                    style={{ flex: 1, backgroundColor: C.forest, borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}>
                    <Text style={{ color: C.white, fontWeight: '600', fontSize: 13 }}>{acting===b.id?'...':'✓ Confirm'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => updateStatus(b.id, 'rejected')} disabled={acting===b.id}
                    style={{ flex: 1, backgroundColor: '#fff5f5', borderRadius: 8, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#fed7d7' }}>
                    <Text style={{ color: C.red, fontWeight: '600', fontSize: 13 }}>{acting===b.id?'...':'✕ Reject'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          )}
        />
      )}
    </View>
  )
}

export function CommissionsScreen() {
  const [data,    setData]    = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    transactionsApi.mine()
      .then(r => setData(r.data.data ?? r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const hasUnpaid = data.some((t: any) => t.commission && ['pending','reminded','overdue'].includes(t.commission?.status))

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <ScreenHeader title="Invoices" label="Billing" onBack={() => router.back()} />

      {/* Redirect unpaid invoices to web */}
      {hasUnpaid && (
        <TouchableOpacity
          onPress={() => Linking.openURL(`${WEB_URL}/dashboard/commissions`)}
          style={{ margin: 16, backgroundColor: '#fff5f5', borderRadius: 14, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Text style={{ fontSize: 18 }}>⚠️</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: C.red }}>You have outstanding invoices</Text>
            <Text style={{ fontSize: 11, color: '#c53030', marginTop: 3, lineHeight: 16 }}>
              Tap to settle on the website. Contact support@findmyhomeuganda.com for help.
            </Text>
          </View>
          <Text style={{ color: C.red, fontSize: 18 }}>›</Text>
        </TouchableOpacity>
      )}

      {loading ? <Loading /> : !data.filter((t: any) => t.commission).length ? (
        <Empty emoji="🧾" title="No invoices yet" description="Service fee invoices appear here after confirmed sales." />
      ) : (
        <FlatList data={data.filter((t: any) => t.commission)} keyExtractor={(i: any) => i.id} contentContainerStyle={{ padding: 16 }}
          renderItem={({ item: t }: { item: any }) => {
            const c = t.commission
            return (
              <Card style={{ marginBottom: 12, padding: 14 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: C.ink }} numberOfLines={1}>{t.property?.title}</Text>
                <Text style={{ fontSize: 11, color: C.stone, marginTop: 2 }}>{t.property?.location}</Text>
                <Divider />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ fontSize: 11, color: C.dust }}>Sale Price</Text>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: C.ink }}>{formatUGX(t.agreed_price)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 11, color: C.dust }}>Service Fee</Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: c.is_overdue ? C.red : C.ink }}>{formatUGX(c.commission_amount)}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                  <Text style={{ fontSize: 11, color: c.is_overdue ? C.red : C.stone }}>
                    Due: {c.due_date}{c.is_overdue ? ` (${c.days_overdue}d overdue)` : ''}
                  </Text>
                  <Badge label={c.status} color={c.status==='paid'?'green':c.status==='overdue'?'red':c.status==='reminded'?'amber':'grey'} />
                </View>
                {['pending','reminded','overdue'].includes(c.status) && (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`${WEB_URL}/dashboard/commissions`)}
                    style={{ marginTop: 10, backgroundColor: C.ink, borderRadius: 8, paddingVertical: 9, alignItems: 'center' }}>
                    <Text style={{ color: C.white, fontWeight: '600', fontSize: 12 }}>Settle on Website →</Text>
                  </TouchableOpacity>
                )}
              </Card>
            )
          }}
        />
      )}
    </View>
  )
}

export function NotificationsScreen() {
  const [data,    setData]    = useState<any[]>([])
  const [unread,  setUnread]  = useState(0)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try { const r = await notificationsApi.list(); setData(r.data.notifications?.data ?? []); setUnread(r.data.unread_count ?? 0) }
    catch {} finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const markAll = async () => { await notificationsApi.markAllRead(); load() }

  const emoji = (type: string) => {
    if (type?.includes('kyc'))         return '✅'
    if (type?.includes('lead'))        return '📩'
    if (type?.includes('commission'))  return '💰'
    if (type?.includes('booking'))     return '📅'
    if (type?.includes('transaction')) return '🤝'
    if (type?.includes('suspended'))   return '🔴'
    if (type?.includes('reactivated')) return '🟢'
    return '🔔'
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 16 }}>
        <ScreenHeader title={`Notifications${unread > 0 ? ` (${unread})` : ''}`} label="Inbox" onBack={() => router.back()} />
        {unread > 0 && (
          <TouchableOpacity onPress={markAll} style={{ marginTop: 20 }}>
            <Text style={{ fontSize: 12, color: C.gold }}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>
      {loading ? <Loading /> : !data.length ? (
        <Empty emoji="🔔" title="No notifications" description="You are all caught up!" />
      ) : (
        <FlatList data={data} keyExtractor={(i: any) => i.id} contentContainerStyle={{ padding: 16 }}
          renderItem={({ item: n }: { item: any }) => (
            <TouchableOpacity onPress={async () => { if (!n.read_at) { await notificationsApi.markRead(n.id); load() } }} activeOpacity={0.8}
              style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 14, marginBottom: 8,
                backgroundColor: n.read_at ? C.white : '#fdf7ee',
                borderWidth: 1, borderColor: n.read_at ? C.sand : C.gold + '40' }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18 }}>{emoji(n.type)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: n.read_at ? C.stone : C.ink, fontWeight: n.read_at ? '400' : '500', lineHeight: 19 }}>
                  {n.data?.message ?? 'New notification'}
                </Text>
                <Text style={{ fontSize: 10, color: C.dust, marginTop: 4 }}>{timeAgo(n.created_at)}</Text>
              </View>
              {!n.read_at && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.gold, marginTop: 4 }} />}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}

export function ListingsScreen() {
  const [data,      setData]      = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [refreshing,setRefreshing]= useState(false)

  const load = async (refresh = false) => {
    if (!refresh) setLoading(true)
    try { const r = await propertiesApi.mine(); setData(r.data.data ?? r.data) }
    catch {} finally { setLoading(false); setRefreshing(false) }
  }
  useEffect(() => { load() }, [])

  const statusColor = (s: string) => s==='active'?'green':s==='frozen'||s==='draft'?'amber':s==='sold'||s==='rented'?'blue':'grey'

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <ScreenHeader title="My Listings" label="Properties" onBack={() => router.back()} />
      <TouchableOpacity onPress={() => router.push('/dashboard/new-listing' as any)}
        style={{ margin: 16, backgroundColor: C.gold, borderRadius: 12, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
        <Text style={{ color: C.white, fontWeight: '700', fontSize: 13 }}>➕ New Listing</Text>
      </TouchableOpacity>
      {loading ? <Loading /> : !data.length ? (
        <Empty emoji="🏠" title="No listings yet" description="Tap New Listing to post your first property." />
      ) : (
        <FlatList data={data} keyExtractor={(i: any) => i.id} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true) }} tintColor={C.gold} />}
          renderItem={({ item: l }: { item: any }) => (
            <Card style={{ marginBottom: 12, padding: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: C.ink }} numberOfLines={1}>{l.title}</Text>
                  <Text style={{ fontSize: 12, color: C.stone, marginTop: 2 }}>{l.location}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '500', color: C.ink, marginTop: 6 }}>{formatUGX(l.price)}</Text>
                </View>
                <Badge label={l.status} color={statusColor(l.status) as any} />
              </View>
              {(l.leads_count > 0 || l.bookings_count > 0) && (
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.sand }}>
                  {l.leads_count > 0    && <Text style={{ fontSize: 11, color: C.stone }}>📩 {l.leads_count} leads</Text>}
                  {l.bookings_count > 0 && <Text style={{ fontSize: 11, color: C.stone }}>📅 {l.bookings_count} bookings</Text>}
                </View>
              )}
            </Card>
          )}
        />
      )}
    </View>
  )
}
