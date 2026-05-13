'use client'
import { useEffect, useState } from 'react'
import { subAdminApi } from '@/lib/api'
import { timeAgo } from '@/lib/utils'
import { Badge, Table, Th, Td, Pagination, EmptyState } from '@/components/ui'
import toast from 'react-hot-toast'

export default function SubAdminRatingsPage() {
  const [ratings, setRatings] = useState<any[]>([])
  const [meta,    setMeta]    = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [page,    setPage]    = useState(1)

  const fetch = (p = page) => {
    setLoading(true)
    subAdminApi.listRatings({ page: p })
      .then(r => { setRatings(r.data.data); setMeta(r.data.meta ?? r.data) })
      .catch(e => toast.error(e.response?.data?.message ?? 'Failed to load ratings.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetch(page) }, [page])

  const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n)

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-light text-ink mb-1">Reviews</h1>
        <p className="text-sm text-stone">View buyer reviews and ratings — read only.</p>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-sand rounded-xl animate-pulse" />)}</div>
      ) : ratings.length === 0 ? (
        <div className="card">
          <EmptyState emoji="⭐" title="No reviews yet" description="Reviews left by buyers will appear here." />
        </div>
      ) : (
        <div className="space-y-3">
          {ratings.map(r => (
            <div key={r.id} className={`card p-5 ${r.hidden ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-ink">{r.buyer?.name ?? '—'}</span>
                    <span className="text-xs text-stone">→</span>
                    <span className="text-ink font-medium">{r.seller?.company_name ?? r.seller?.name ?? '—'}</span>
                    {r.hidden && <Badge label="Hidden" color="red" />}
                  </div>
                  <div className="text-amber-500 text-sm mb-1.5">{stars(r.rating)}</div>
                  {r.comment && <p className="text-sm text-stone">{r.comment}</p>}
                  <p className="text-xs text-dust mt-1">{timeAgo(r.created_at)}</p>
                </div>
              </div>
            </div>
          ))}
          {meta && (
            <div className="card overflow-hidden">
              <Pagination page={meta.current_page ?? page} lastPage={meta.last_page ?? 1} total={meta.total ?? ratings.length} onPage={setPage} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
