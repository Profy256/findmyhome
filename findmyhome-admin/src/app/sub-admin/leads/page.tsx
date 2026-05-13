'use client'
import { useEffect, useState } from 'react'
import { subAdminApi } from '@/lib/api'
import { timeAgo } from '@/lib/utils'
import { Badge, Table, Th, Td, Pagination, EmptyState } from '@/components/ui'
import toast from 'react-hot-toast'

export default function SubAdminLeadsPage() {
  const [leads,   setLeads]   = useState<any[]>([])
  const [meta,    setMeta]    = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [page,    setPage]    = useState(1)
  const [type,    setType]    = useState('')

  const fetch = (p = page) => {
    setLoading(true)
    subAdminApi.listLeads({ page: p, method: type || undefined })
      .then(r => { setLeads(r.data.data); setMeta(r.data.meta ?? r.data) })
      .catch(e => toast.error(e.response?.data?.message ?? 'Failed to load leads.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetch(1); setPage(1) }, [type])
  useEffect(() => { fetch(page) }, [page])

  const typeColor: Record<string, any> = {
    platform: 'blue', whatsapp: 'green',
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-light text-ink mb-1">Platform Leads</h1>
        <p className="text-sm text-stone">All buyer enquiries and WhatsApp contacts — read only.</p>
      </div>

      <div className="flex gap-2 mb-5">
        {[['', 'All'], ['platform', 'Platform Enquiries'], ['whatsapp', 'WhatsApp']].map(([val, label]) => (
          <button key={val} onClick={() => setType(val)}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all
              ${type === val ? 'bg-ink text-white' : 'bg-cream text-stone hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-sand rounded-xl animate-pulse" />)}</div>
      ) : leads.length === 0 ? (
        <div className="card">
          <EmptyState emoji="📩" title="No leads found" description="Buyer interactions will appear here." />
        </div>
      ) : (
        <div className="card">
          <Table>
            <thead>
              <tr>
                <Th>Buyer</Th>
                <Th>Property</Th>
                <Th>Seller</Th>
                <Th>Type</Th>
                <Th>Time</Th>
              </tr>
            </thead>
            <tbody>
              {leads.map(l => (
                <tr key={l.id} className="hover:bg-cream/50 transition-colors">
                  <Td>
                    <p className="font-medium text-ink">{l.buyer?.name ?? '—'}</p>
                    <p className="text-xs text-stone">{l.buyer?.phone ?? l.buyer?.email}</p>
                  </Td>
                  <Td className="text-xs text-stone line-clamp-1 max-w-[180px]">{l.property?.title ?? '—'}</Td>
                  <Td className="text-xs text-stone">{l.seller?.company_name ?? l.seller?.name ?? '—'}</Td>
                  <Td>
                    <Badge
                      label={l.type === 'whatsapp' ? '📱 WhatsApp' : '🔔 Platform'}
                      color={typeColor[l.type] ?? 'grey'}
                    />
                  </Td>
                  <Td className="text-xs text-stone">{timeAgo(l.created_at)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {meta && <Pagination page={meta.current_page ?? page} lastPage={meta.last_page ?? 1} total={meta.total ?? leads.length} onPage={setPage} />}
        </div>
      )}
    </div>
  )
}
