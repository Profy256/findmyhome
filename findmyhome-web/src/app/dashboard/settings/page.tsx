'use client'
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { authApi } from '@/lib/api'
import api from '@/lib/api'
import { SELLER_CATEGORIES } from '@/lib/utils'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { CheckCircle } from 'lucide-react'

const THRESHOLD: Record<string, number> = { land: 95, apartment: 90, house: 90, rental: 80, airbnb: 80, lodge: 80 }

export default function DashboardSettingsPage() {
  const { user, setAuth, token } = useAuthStore()
  const [name,       setName]       = useState(user?.name ?? '')
  const [phone,      setPhone]      = useState(user?.phone ?? '')
  const [company,    setCompany]    = useState(user?.company_name ?? '')
  const [categories, setCategories] = useState<string[]>(user?.seller_categories ?? [])
  const [saving,     setSaving]     = useState(false)
  const isSeller = user?.role === 'seller' || user?.role === 'company'

  const toggle = (key: string) =>
    setCategories(prev => prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key])

  const strictest = categories.length > 0 ? Math.max(...categories.map(c => THRESHOLD[c] ?? 80)) : null

  const save = async () => {
    if (!name || !phone) { toast.error('Name and phone are required.'); return }
    setSaving(true)
    try {
      const payload: any = { name, phone }
      if (user?.role === 'company') payload.company_name = company
      if (isSeller) payload.seller_categories = categories

      await api.patch('/auth/profile', payload)
      const meRes = await authApi.me()
      if (token) setAuth(meRes.data, token)
      toast.success('Settings saved.')
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to save.')
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div className="mb-8">
        <div className="section-label">Account</div>
        <h1 className="font-display text-3xl font-light text-ink">Settings</h1>
      </div>

      <div className="max-w-xl space-y-6">
        {/* Basic info */}
        <div className="bg-white border border-sand rounded-xl p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-dust mb-5">Profile</h2>

          {user?.role === 'company' && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-ink mb-1.5 uppercase tracking-wide">Company Name</label>
              <input value={company} onChange={e => setCompany(e.target.value)} className="input" />
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs font-medium text-ink mb-1.5 uppercase tracking-wide">Full Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input" />
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium text-ink mb-1.5 uppercase tracking-wide">Phone</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} className="input" />
          </div>

          <div className="mb-2">
            <label className="block text-xs font-medium text-ink mb-1.5 uppercase tracking-wide">Email</label>
            <input value={user?.email ?? ''} disabled className="input opacity-50 cursor-not-allowed" />
            <p className="text-xs text-dust mt-1">Email cannot be changed. Contact support if needed.</p>
          </div>
        </div>

        {/* Seller categories */}
        {isSeller && (
          <div className="bg-white border border-sand rounded-xl p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-dust mb-2">Property Categories</h2>
            <p className="text-xs text-stone mb-5">
              Update the categories you list. Your KYC is assessed at the strictest level selected.
              Adding Land will require you to re-verify at a higher level.
            </p>

            <div className="space-y-2">
              {SELLER_CATEGORIES.map(cat => {
                const selected = categories.includes(cat.key)
                const color = cat.threshold >= 95 ? 'text-red-500' : cat.threshold >= 90 ? 'text-amber-600' : 'text-green-600'
                return (
                  <button key={cat.key} type="button" onClick={() => toggle(cat.key)}
                    className={cn('w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all',
                      selected ? 'border-ink bg-white' : 'border-sand bg-paper hover:border-stone')}>
                    {cat.image ? (
                      <img
                        src={cat.image}
                        alt={cat.label}
                        className="w-9 h-9 rounded-lg bg-white/70 p-1.5 object-contain flex-shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-xl flex-shrink-0">{cat.emoji}</span>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-sm font-semibold', selected ? 'text-ink' : 'text-stone')}>{cat.label}</span>
                        <span className={cn('text-[10px] font-bold uppercase', color)}>{cat.strictness}</span>
                      </div>
                    </div>
                    {selected && <CheckCircle className="w-4 h-4 text-ink" />}
                  </button>
                )
              })}
            </div>

            {strictest !== null && (
              <div className={cn('mt-4 p-3.5 rounded-xl border text-xs leading-relaxed',
                strictest >= 95 ? 'bg-red-50 border-red-200 text-red-700' :
                strictest >= 90 ? 'bg-amber-50 border-amber-200 text-amber-700' :
                'bg-green-50 border-green-200 text-green-700')}>
                {strictest >= 95 ? '⚠️ Land selected — very strict. Land title required per listing.' :
                 strictest >= 90 ? '📋 Moderate verification. Clear National ID required.' :
                 '✅ Light verification. National ID is all you need.'}
              </div>
            )}
          </div>
        )}

        <button onClick={save} disabled={saving}
          className="btn-primary w-full py-3.5 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
