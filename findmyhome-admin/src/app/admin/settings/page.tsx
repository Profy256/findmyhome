'use client'
import { useEffect, useState } from 'react'
import { adminApi } from '@/lib/api'
import toast from 'react-hot-toast'
import { Save } from 'lucide-react'

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState<string | null>(null)
  const [edits,    setEdits]    = useState<Record<string, string>>({})

  useEffect(() => {
    adminApi.getSettings().then(r => {
      setSettings(r.data)
      const defaults: Record<string, string> = {}
      Object.entries(r.data).forEach(([k, v]: [string, any]) => { defaults[k] = v.value })
      setEdits(defaults)
    }).finally(() => setLoading(false))
  }, [])

  const save = async (key: string) => {
    setSaving(key)
    try {
      await adminApi.updateSetting(key, edits[key])
      toast.success(`"${settings[key]?.label}" updated.`)
      setSettings(prev => ({ ...prev, [key]: { ...prev[key], value: edits[key] } }))
    } catch { toast.error('Failed to update setting.') }
    finally { setSaving(null) }
  }

  if (loading) return <div className="space-y-4">{[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-sand rounded-xl animate-pulse" />)}</div>

  const sections: Record<string, string[]> = {
    'Commission': ['commission_rate', 'commission_rate_company', 'commission_block_threshold', 'commission_due_days'],
    'Reminder Schedule': ['commission_reminder_1_days', 'commission_reminder_2_days', 'commission_reminder_3_days'],
    'Fees & Pricing': ['booking_fee_rate', 'blue_badge_price', 'company_free_badge_days', 'company_free_featured_slots'],
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-light text-ink mb-1">Platform Settings</h1>
        <p className="text-sm text-stone">All changes take effect immediately. No code changes needed.</p>
      </div>

      <div className="space-y-6">
        {Object.entries(sections).map(([sectionTitle, keys]) => (
          <div key={sectionTitle} className="card p-5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-dust mb-5">{sectionTitle}</h2>
            <div className="space-y-4">
              {keys.filter(k => settings[k]).map(key => {
                const s = settings[key]
                const isDirty = edits[key] !== s.value
                return (
                  <div key={key} className="flex items-start gap-4">
                    <div className="flex-1">
                      <label className="text-sm font-semibold text-ink block mb-0.5">{s.label}</label>
                      {s.description && <p className="text-xs text-stone mb-2">{s.description}</p>}
                      <input
                        type={s.type === 'integer' || s.type === 'float' ? 'number' : 'text'}
                        step={s.type === 'float' ? '0.1' : '1'}
                        value={edits[key] ?? s.value}
                        onChange={e => setEdits(prev => ({ ...prev, [key]: e.target.value }))}
                        className="input max-w-xs"
                      />
                    </div>
                    <button
                      onClick={() => save(key)}
                      disabled={!isDirty || saving === key}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold mt-6 transition-all
                        ${isDirty ? 'bg-ink text-white hover:bg-ink-2' : 'bg-sand text-dust cursor-not-allowed'}`}>
                      <Save className="w-3.5 h-3.5" />
                      {saving === key ? 'Saving…' : isDirty ? 'Save' : 'Saved'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
