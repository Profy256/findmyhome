'use client'
import { useEffect, useState } from 'react'
import { subAdminApi } from '@/lib/api'
import { timeAgo } from '@/lib/utils'
import toast from 'react-hot-toast'
import { CheckCircle2, Eye, Shield } from 'lucide-react'

const DOC_LABELS: Record<string, string> = {
  national_id: 'National ID', passport: 'Passport',
  drivers_licence: "Driver's Licence", business_registration: 'Business Registration',
}
const KYC_LEVEL_LABELS: Record<string, { label: string; color: string }> = {
  land:      { label: 'Strict (95%)',   color: 'text-red-500 bg-red-50 border-red-200'     },
  apartment: { label: 'Moderate (90%)', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  house:     { label: 'Moderate (90%)', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  rental:    { label: 'Light (80%)',    color: 'text-forest-2 bg-green-50 border-green-200'  },
  airbnb:    { label: 'Light (80%)',    color: 'text-forest-2 bg-green-50 border-green-200'  },
  lodge:     { label: 'Light (80%)',    color: 'text-forest-2 bg-green-50 border-green-200'  },
}

export default function SubAdminKycPage() {
  const [docs,    setDocs]    = useState<any[]>([])
  const [filter,  setFilter]  = useState('pending')
  const [loading, setLoading] = useState(true)
  const [acting,  setActing]  = useState<string | null>(null)

  const fetchDocs = () => {
    setLoading(true)
    subAdminApi.listKyc({ status: filter }).then(r => setDocs(r.data.data ?? [])).finally(() => setLoading(false))
  }

  useEffect(() => { fetchDocs() }, [filter])

  const approve = async (id: string) => {
    setActing(id)
    try {
      await subAdminApi.approveKyc(id)
      toast.success('KYC approved. Seller has been notified.')
      fetchDocs()
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Failed.') }
    finally { setActing(null) }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-light text-ink mb-1">KYC Review</h1>
        <p className="text-sm text-stone">Review and approve seller identity documents.</p>
      </div>

      <div className="flex gap-2 mb-6">
        {['pending', 'verified', 'rejected'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-full text-xs font-semibold capitalize transition-all
              ${filter === s ? 'bg-ink text-white' : 'bg-cream text-stone hover:text-ink'}`}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-sand rounded-xl animate-pulse" />)}</div>
      ) : docs.length === 0 ? (
        <div className="text-center py-16 card">
          <Shield className="w-10 h-10 text-sand mx-auto mb-3" />
          <p className="text-sm text-stone">No {filter} documents.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {docs.map(doc => {
            const strictest = doc.user?.seller_categories?.reduce((a: string, b: string) => {
              const order = ['land', 'apartment', 'house', 'rental', 'airbnb', 'lodge']
              return order.indexOf(a) < order.indexOf(b) ? a : b
            }, doc.user?.seller_categories?.[0])
            const kycLevel = strictest ? KYC_LEVEL_LABELS[strictest] : null

            return (
              <div key={doc.id} className="card p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-ink flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-semibold">{doc.user?.name?.[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-ink">{doc.user?.company_name ?? doc.user?.name}</span>
                      <span className="text-xs text-stone capitalize px-2 py-0.5 bg-cream rounded-full">{doc.user?.role}</span>
                      {kycLevel && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${kycLevel.color}`}>
                          {kycLevel.label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone">{doc.user?.email} · {doc.user?.phone}</p>
                    {doc.user?.seller_categories?.length > 0 && (
                      <p className="text-xs text-stone mt-0.5">
                        Categories: {doc.user.seller_categories.map((c: string) => c.replace('_', ' ')).join(', ')}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-xs font-semibold text-ink bg-sand px-2.5 py-1 rounded-full">
                        {DOC_LABELS[doc.document_type] ?? doc.document_type}
                      </span>
                      <span className="text-xs text-dust">{timeAgo(doc.created_at)}</span>
                      {doc.ai_confidence_score != null && (
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full
                          ${doc.ai_confidence_score >= 90 ? 'bg-green-100 text-forest-2' : doc.ai_confidence_score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                          AI: {doc.ai_confidence_score}%
                        </span>
                      )}
                    </div>

                    {doc.review_note && (
                      <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-xs text-amber-700">{doc.review_note}</p>
                      </div>
                    )}
                    {doc.rejection_reason && (
                      <p className="text-xs text-red-500 mt-2">Reason: {doc.rejection_reason}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-sand rounded-lg text-xs text-stone hover:bg-cream transition-colors">
                      <Eye className="w-3.5 h-3.5" /> View Doc
                    </a>
                    {filter === 'pending' && (
                      <button onClick={() => approve(doc.id)} disabled={acting === doc.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-forest text-white rounded-lg text-xs hover:opacity-90 transition-opacity disabled:opacity-60">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {acting === doc.id ? 'Approving…' : 'Approve'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
