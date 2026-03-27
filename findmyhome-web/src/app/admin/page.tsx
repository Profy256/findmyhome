'use client'
import { useEffect, useState } from 'react'
import { adminApi } from '@/lib/api'
import { formatUGX } from '@/lib/utils'
import { Users, Home, MessageSquare, DollarSign, AlertTriangle, Clock } from 'lucide-react'

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.dashboard().then(r => setStats(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(8)].map((_, i) => <div key={i} className="h-28 bg-sand rounded-xl animate-pulse" />)}
    </div>
  )

  const s = stats

  const cards = [
    { label: 'Total Users',       value: s?.users?.total,            icon: Users,        color: 'text-blue-600 bg-blue-50'  },
    { label: 'Active Listings',   value: s?.properties?.active,      icon: Home,         color: 'text-forest-2 bg-green-50' },
    { label: 'Total Leads',       value: s?.leads?.total,            icon: MessageSquare,color: 'text-wa bg-wa/10'          },
    { label: 'Pending KYC',       value: s?.users?.kyc_pending,      icon: Clock,        color: 'text-amber-600 bg-amber-50'},
    { label: 'Blocked Users',     value: s?.users?.blocked,          icon: AlertTriangle,color: 'text-red-500 bg-red-50'   },
    { label: 'Overdue Commissions',value: s?.commissions?.overdue,   icon: AlertTriangle,color: 'text-red-500 bg-red-50'   },
    { label: 'Commission Collected',value: formatUGX(s?.revenue?.commission_ugx ?? 0), icon: DollarSign, color: 'text-gold bg-gold/10' },
    { label: 'Leads Today',       value: s?.leads?.today,            icon: MessageSquare,color: 'text-ink bg-cream'         },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-light text-ink mb-1">Admin Dashboard</h1>
        <p className="text-sm text-stone">Platform overview — Find My Home Uganda</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="font-display text-2xl font-semibold text-ink">{value ?? 0}</div>
            <div className="text-xs text-stone mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Platform settings quick view */}
      <div className="card p-5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-dust mb-4">Current Settings</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            ['Commission (Individuals)', `${s?.current_settings?.commission_rate ?? 5}%`],
            ['Commission (Companies)',   `${s?.current_settings?.commission_rate_company ?? 3}%`],
            ['Block Threshold',          `${s?.current_settings?.commission_block_threshold ?? 3} unpaid`],
            ['Due Days',                 `${s?.current_settings?.commission_due_days ?? 14} days`],
            ['Blue Badge Price',         formatUGX(s?.current_settings?.blue_badge_price_ugx ?? 300000)],
          ].map(([l, v]) => (
            <div key={l as string} className="text-center p-3 bg-cream rounded-lg">
              <div className="text-sm font-semibold text-ink">{v}</div>
              <div className="text-[10px] text-stone mt-0.5">{l}</div>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <a href="/admin/settings" className="text-xs text-stone hover:text-ink underline">Edit settings →</a>
        </div>
      </div>
    </div>
  )
}
