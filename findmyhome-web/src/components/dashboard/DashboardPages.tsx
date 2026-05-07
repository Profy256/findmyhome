'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { leadsApi, bookingsApi, transactionsApi, notificationsApi } from '@/lib/api'
import { formatUGX, timeAgo, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  PageLoader, EmptyState, StatCard, Table, Th, Td,
  Pagination, Badge, Modal, ConfirmDialog
} from '@/components/ui'
import {
  MessageCircle, Phone, TrendingUp, DollarSign,
  CheckCircle, XCircle, Bell, Calendar
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── LEADS PAGE ────────────────────────────────────────────────────────────────
export function LeadsPage() {
  const [data,    setData]    = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [page,    setPage]    = useState(1)
  const [method,  setMethod]  = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await leadsApi.mine({ page, contact_method: method || undefined })
      setData(r.data)
    } catch {} finally { setLoading(false) }
  }, [page, method])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="mb-8">
        <div className="section-label">Activity</div>
        <h1 className="font-display text-3xl font-light text-ink">My Leads</h1>
        <p className="text-sm text-stone mt-1">Every buyer who contacted you through Find My Home</p>
      </div>

      {data?.summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Leads"  value={data.summary.total}    icon={TrendingUp} />
          <StatCard label="WhatsApp"     value={data.summary.whatsapp} color="text-green-600" icon={MessageCircle} />
          <StatCard label="Platform"     value={data.summary.platform} icon={MessageCircle} />
          <StatCard label="Today"        value={data.summary.today}    color="text-gold" icon={TrendingUp} />
        </div>
      )}

      <div className="flex gap-2 mb-6">
        {[['', 'All'], ['whatsapp', '💬 WhatsApp'], ['platform', '📩 Platform']].map(([v, l]) => (
          <button key={v} onClick={() => { setMethod(v); setPage(1) }}
            className={`px-4 py-2 rounded-lg text-sm border transition-all ${method === v ? 'bg-ink text-white border-ink' : 'bg-white text-stone border-sand hover:border-stone'}`}>
            {l}
          </button>
        ))}
      </div>

      {loading ? <PageLoader /> : !data?.leads?.data?.length ? (
        <EmptyState emoji="📭" title="No leads yet"
          description="When buyers contact you through Find My Home, their leads appear here." />
      ) : (
        <div className="bg-white rounded-xl border border-sand overflow-hidden">
          <Table>
            <thead><tr><Th>Buyer</Th><Th>Property</Th><Th>Channel</Th><Th>Time</Th><Th>Action</Th></tr></thead>
            <tbody>
              {data.leads.data.map((lead: any) => (
                <tr key={lead.id} className="hover:bg-cream/50">
                  <Td>
                    <p className="font-medium text-ink">{lead.buyer?.name}</p>
                    <p className="text-xs text-stone flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" />{lead.buyer?.phone}
                    </p>
                  </Td>
                  <Td>
                    <Link href={`/properties/${lead.property?.id}`} className="font-medium text-ink hover:text-gold line-clamp-1">
                      {lead.property?.title}
                    </Link>
                    <p className="text-xs text-stone mt-0.5">{lead.property?.location}</p>
                  </Td>
                  <Td>
                    <Badge
                      label={lead.contact_method === 'whatsapp' ? '💬 WhatsApp' : '📩 Platform'}
                      color={lead.contact_method === 'whatsapp' ? 'green' : 'blue'} />
                  </Td>
                  <Td><span className="text-xs text-stone">{timeAgo(lead.created_at)}</span></Td>
                  <Td>
                    {lead.contact_method === 'whatsapp' ? (
                      <a href={`https://wa.me/${lead.buyer?.phone?.replace(/\D/g, '')}`}
                        target="_blank" rel="noreferrer"
                        className="text-xs font-semibold text-green-600 hover:underline">Open WhatsApp →</a>
                    ) : <span className="text-xs text-stone">Platform enquiry</span>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={page} lastPage={data.leads.last_page ?? 1} onPage={setPage} total={data.leads.total ?? 0} />
        </div>
      )}
    </div>
  )
}

// ── BOOKINGS PAGE ─────────────────────────────────────────────────────────────
export function BookingsPage() {
  const [data,    setData]    = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState<{ id: string; status: 'confirmed' | 'rejected' } | null>(null)
  const [acting,  setActing]  = useState(false)

  const load = async () => {
    setLoading(true)
    try { const r = await bookingsApi.mine(); setData(r.data.data ?? r.data) }
    catch {} finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const handleStatus = async () => {
    if (!confirm) return
    setActing(true)
    try {
      await bookingsApi.updateStatus(confirm.id, { status: confirm.status })
      toast.success(`Booking ${confirm.status}.`)
      setConfirm(null)
      load()
    } catch { toast.error('Failed to update booking.') }
    finally { setActing(false) }
  }

  const statusColor = (s: string) =>
    s === 'confirmed' ? 'green' : s === 'rejected' || s === 'cancelled' ? 'red' :
    s === 'completed' ? 'blue' : 'amber'

  return (
    <div>
      <div className="mb-8">
        <div className="section-label">Rentals</div>
        <h1 className="font-display text-3xl font-light text-ink">Bookings</h1>
        <p className="text-sm text-stone mt-1">Online booking requests for your rental properties</p>
      </div>

      {loading ? <PageLoader /> : !data.length ? (
        <EmptyState emoji="📅" title="No bookings yet"
          description="Online bookings for your short stay and rental properties will appear here." />
      ) : (
        <div className="bg-white rounded-xl border border-sand overflow-hidden">
          <Table>
            <thead><tr><Th>Guest</Th><Th>Property</Th><Th>Dates</Th><Th>Amount</Th><Th>Payment</Th><Th>Status</Th><Th>Actions</Th></tr></thead>
            <tbody>
              {data.map((b: any) => (
                <tr key={b.id} className="hover:bg-cream/50">
                  <Td>
                    <p className="font-medium text-ink">{b.buyer?.name}</p>
                    <p className="text-xs text-stone">{b.buyer?.phone}</p>
                  </Td>
                  <Td>
                    <p className="font-medium text-ink line-clamp-1">{b.property?.title}</p>
                    <p className="text-xs text-stone">{b.property?.location}</p>
                  </Td>
                  <Td>
                    <p className="text-xs text-ink font-medium">{b.checkin_date} → {b.checkout_date}</p>
                    <p className="text-xs text-stone">{b.nights} nights · {b.guests} guests</p>
                  </Td>
                  <Td>
                    <p className="font-semibold text-ink text-sm">{formatUGX(b.total_price)}</p>
                    <p className="text-xs text-stone">Platform fee: {formatUGX(b.platform_fee)}</p>
                  </Td>
                  <Td>
                    <Badge label={b.payment_status} color={b.payment_status === 'paid' ? 'green' : 'amber'} />
                  </Td>
                  <Td><Badge label={b.status} color={statusColor(b.status) as any} /></Td>
                  <Td>
                    {b.status === 'pending' && (
                      <div className="flex gap-2">
                        <button onClick={() => setConfirm({ id: b.id, status: 'confirmed' })}
                          className="px-3 py-1 text-xs rounded-lg bg-forest/10 text-forest border border-forest/20 hover:bg-forest/20 font-medium">
                          Confirm
                        </button>
                        <button onClick={() => setConfirm({ id: b.id, status: 'rejected' })}
                          className="px-3 py-1 text-xs rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 font-medium">
                          Reject
                        </button>
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleStatus}
        title={confirm?.status === 'confirmed' ? 'Confirm This Booking' : 'Reject This Booking'}
        message={confirm?.status === 'confirmed'
          ? 'The guest will be notified that their booking is confirmed.'
          : 'The guest will be notified that their booking was not accepted.'}
        confirmLabel={confirm?.status === 'confirmed' ? 'Yes, Confirm' : 'Yes, Reject'}
        danger={confirm?.status === 'rejected'}
        loading={acting}
      />
    </div>
  )
}

// ── COMMISSIONS PAGE ──────────────────────────────────────────────────────────
export function CommissionsPage() {
  const [data,    setData]    = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    transactionsApi.mine()
      .then(r => setData(r.data.data ?? r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const totalOwed = data
    .filter((t: any) => t.commission && ['pending', 'reminded', 'overdue'].includes(t.commission?.status))
    .reduce((sum: number, t: any) => sum + (t.commission?.commission_amount ?? 0), 0)

  const totalPaid = data
    .filter((t: any) => t.commission?.status === 'paid')
    .reduce((sum: number, t: any) => sum + (t.commission?.commission_amount ?? 0), 0)

  return (
    <div>
      <div className="mb-8">
        <div className="section-label">Finance</div>
        <h1 className="font-display text-3xl font-light text-ink">Commissions</h1>
        <p className="text-sm text-stone mt-1">Platform commission on confirmed sales and rentals</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <StatCard label="Outstanding"  value={formatUGX(totalOwed)} color={totalOwed > 0 ? 'text-red-500' : 'text-stone'} icon={DollarSign} />
        <StatCard label="Total Paid"   value={formatUGX(totalPaid)} color="text-green-600"  icon={CheckCircle} />
      </div>

      {totalOwed > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex gap-3 items-start">
          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">Outstanding commissions: {formatUGX(totalOwed)}</p>
            <p className="text-xs text-red-600 mt-1">
              Your account will be suspended after 3 overdue commission payments.
              Contact <a href="mailto:support@findmyhomeuganda.com" className="underline">support@findmyhomeuganda.com</a> to arrange payment.
            </p>
          </div>
        </div>
      )}

      {loading ? <PageLoader /> : !data.filter((t: any) => t.commission).length ? (
        <EmptyState emoji="💰" title="No commissions yet"
          description="Commission invoices appear here after confirmed sales or rentals." />
      ) : (
        <div className="bg-white rounded-xl border border-sand overflow-hidden">
          <Table>
            <thead><tr><Th>Property</Th><Th>Agreed Price</Th><Th>Commission (5%)</Th><Th>Due Date</Th><Th>Status</Th></tr></thead>
            <tbody>
              {data.filter((t: any) => t.commission).map((t: any) => {
                const c = t.commission
                return (
                  <tr key={t.id} className={cn('hover:bg-cream/50', c.is_overdue && 'bg-red-50/30')}>
                    <Td>
                      <p className="font-medium text-ink line-clamp-1">{t.property?.title}</p>
                      <p className="text-xs text-stone">{t.property?.location}</p>
                    </Td>
                    <Td><span className="font-medium">{formatUGX(t.agreed_price)}</span></Td>
                    <Td>
                      <span className={cn('font-semibold', c.is_overdue ? 'text-red-500' : 'text-ink')}>
                        {formatUGX(c.commission_amount)}
                      </span>
                    </Td>
                    <Td>
                      <p className={cn('text-sm', c.is_overdue ? 'text-red-500 font-semibold' : 'text-ink')}>{c.due_date}</p>
                      {c.is_overdue && c.days_overdue > 0 &&
                        <p className="text-xs text-red-400 mt-0.5">{c.days_overdue} days overdue</p>}
                    </Td>
                    <Td>
                      <Badge
                        label={c.status}
                        color={c.status === 'paid' ? 'green' : c.status === 'overdue' ? 'red' : c.status === 'reminded' ? 'amber' : 'grey'}
                      />
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ── NOTIFICATIONS PAGE ────────────────────────────────────────────────────────
export function NotificationsPage() {
  const [data,    setData]    = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [unread,  setUnread]  = useState(0)

  const load = async () => {
    setLoading(true)
    try {
      const r = await notificationsApi.list()
      setData(r.data.notifications?.data ?? [])
      setUnread(r.data.unread_count ?? 0)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const markAllRead = async () => {
    await notificationsApi.markAllRead()
    load()
    toast.success('All notifications marked as read.')
  }

  const markOne = async (id: string) => {
    await notificationsApi.markRead(id)
    load()
  }

  const notifIcon = (type: string) => {
    if (type?.includes('kyc'))         return '✅'
    if (type?.includes('lead'))        return '📩'
    if (type?.includes('commission'))  return '💰'
    if (type?.includes('booking'))     return '📅'
    if (type?.includes('transaction')) return '🤝'
    if (type?.includes('suspended'))   return '🔴'
    if (type?.includes('reactivated')) return '🟢'
    if (type?.includes('duplicate'))   return '⚠️'
    return '🔔'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="section-label">Inbox</div>
          <h1 className="font-display text-3xl font-light text-ink">Notifications</h1>
          {unread > 0 && <p className="text-sm text-gold mt-1">{unread} unread</p>}
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="btn-outline py-2 px-4 text-sm">Mark all read</button>
        )}
      </div>

      {loading ? <PageLoader /> : !data.length ? (
        <EmptyState emoji="🔔" title="No notifications" description="You are all caught up." />
      ) : (
        <div className="space-y-2">
          {data.map((n: any) => (
            <div key={n.id}
              className={cn('flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer',
                n.read_at ? 'bg-white border-sand' : 'bg-gold/5 border-gold/20')}
              onClick={() => !n.read_at && markOne(n.id)}>
              <div className="w-9 h-9 rounded-full bg-cream flex items-center justify-center flex-shrink-0 text-base">
                {notifIcon(n.type)}
              </div>
              <div className="flex-1">
                <p className={cn('text-sm leading-relaxed', n.read_at ? 'text-stone' : 'text-ink font-medium')}>
                  {n.data?.message ?? 'New notification'}
                </p>
                <p className="text-xs text-dust mt-1">{timeAgo(n.created_at)}</p>
              </div>
              {!n.read_at && <div className="w-2 h-2 rounded-full bg-gold flex-shrink-0 mt-2" />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
