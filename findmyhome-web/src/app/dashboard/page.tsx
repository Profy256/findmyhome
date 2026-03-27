'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'
import { leadsApi, propertiesApi, notificationsApi } from '@/lib/api'
import { formatUGX, timeAgo } from '@/lib/utils'
import { TrendingUp, Eye, MessageSquare, DollarSign, Plus, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [leads,     setLeads]     = useState<any>(null)
  const [listings,  setListings]  = useState<any>(null)
  const [notifs,    setNotifs]    = useState<any>(null)
  const [loading,   setLoading]   = useState(true)

  const isSeller = user?.role === 'seller' || user?.role === 'company'

  useEffect(() => {
    const calls: Promise<any>[] = [notificationsApi.unread()]
    if (isSeller) {
      calls.push(leadsApi.mine())
      calls.push(propertiesApi.mine())
    }
    Promise.all(calls).then(([n, l, p]) => {
      setNotifs(n.data); setLeads(l?.data); setListings(p?.data)
    }).finally(() => setLoading(false))
  }, [])

  const kycStatus = user?.kyc_status

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-light text-ink mb-1">
          Welcome back, {(user?.company_name ?? user?.name)?.split(' ')[0]}
        </h1>
        <p className="text-sm text-stone">Here's what's happening with your account.</p>
      </div>

      {/* KYC alert */}
      {isSeller && kycStatus !== 'verified' && (
        <div className={`flex items-start gap-3 p-4 rounded-xl mb-6 border
          ${kycStatus === 'pending' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
          {kycStatus === 'pending'
            ? <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            : <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          }
          <div>
            <p className="text-sm font-semibold text-ink mb-0.5">
              {kycStatus === 'pending' ? 'Verification in progress' : kycStatus === 'none' ? 'Verify your identity to start listing' : 'Verification failed — please resubmit'}
            </p>
            <p className="text-xs text-stone">
              {kycStatus === 'pending' ? 'Our AI is reviewing your document. You will be notified within minutes.' : 'Upload your National ID or Passport to get verified and list properties.'}
            </p>
            {kycStatus !== 'pending' && (
              <Link href="/dashboard/kyc" className="text-xs font-semibold text-ink underline mt-1.5 inline-block">
                Go to Verification →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Blocked alert */}
      {isSeller && kycStatus === 'blocked' && (
        <div className="flex items-start gap-3 p-4 rounded-xl mb-6 bg-red-50 border border-red-200">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700 mb-0.5">Account Suspended</p>
            <p className="text-xs text-red-600">Your account has been suspended due to unpaid commissions. Pay your outstanding commissions to restore access.</p>
            <Link href="/dashboard/commissions" className="text-xs font-semibold text-red-700 underline mt-1.5 inline-block">Pay Commissions →</Link>
          </div>
        </div>
      )}

      {/* Stats */}
      {isSeller && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Active Listings',  value: listings?.total ?? 0,         icon: Eye,            color: 'bg-blue-50 text-blue-600' },
            { label: 'Total Leads',      value: leads?.summary?.total ?? 0,   icon: MessageSquare,  color: 'bg-green-50 text-green-600' },
            { label: 'WhatsApp Leads',   value: leads?.summary?.whatsapp ?? 0,icon: TrendingUp,     color: 'bg-wa/10 text-wa' },
            { label: "Today's Leads",    value: leads?.summary?.today ?? 0,   icon: DollarSign,     color: 'bg-gold/10 text-gold' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card p-5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="font-display text-2xl font-semibold text-ink">{value}</div>
              <div className="text-xs text-stone mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Quick actions */}
        <div className="card p-5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-dust mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {isSeller && kycStatus === 'verified' && (
              <Link href="/dashboard/listings/new"
                className="flex items-center gap-3 p-3 rounded-lg bg-ink text-white hover:bg-ink-2 transition-colors">
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">Add New Listing</span>
              </Link>
            )}
            <Link href="/search"
              className="flex items-center gap-3 p-3 rounded-lg bg-cream hover:bg-sand transition-colors">
              <Eye className="w-4 h-4 text-stone" />
              <span className="text-sm text-ink">Browse Properties</span>
            </Link>
            {isSeller && (
              <Link href="/dashboard/leads"
                className="flex items-center gap-3 p-3 rounded-lg bg-cream hover:bg-sand transition-colors">
                <MessageSquare className="w-4 h-4 text-stone" />
                <span className="text-sm text-ink">View All Leads</span>
              </Link>
            )}
            {isSeller && kycStatus !== 'verified' && (
              <Link href="/dashboard/kyc"
                className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors">
                <CheckCircle2 className="w-4 h-4 text-amber-600" />
                <span className="text-sm text-amber-700 font-medium">Complete Verification</span>
              </Link>
            )}
          </div>
        </div>

        {/* Recent notifications */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wide text-dust">Recent Notifications</h2>
            {(notifs?.count ?? 0) > 0 && (
              <span className="text-xs font-bold bg-ink text-white px-2 py-0.5 rounded-full">{notifs.count}</span>
            )}
          </div>
          {notifs?.notifications?.length > 0 ? (
            <div className="space-y-2">
              {notifs.notifications.slice(0, 5).map((n: any) => (
                <div key={n.id} className="p-3 rounded-lg bg-cream text-xs text-stone leading-relaxed">
                  {n.data?.message ?? 'New notification'}
                  <p className="text-dust mt-0.5">{timeAgo(n.created_at)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone text-center py-4">No new notifications</p>
          )}
          <Link href="/dashboard/notifications" className="text-xs text-stone hover:text-ink underline mt-3 inline-block">
            View all →
          </Link>
        </div>
      </div>
    </div>
  )
}
