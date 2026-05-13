'use client'
import { useEffect, useState } from 'react'
import { subAdminApi } from '@/lib/api'
import { formatUGX, formatDate } from '@/lib/utils'
import { Badge, Table, Th, Td, Pagination, EmptyState } from '@/components/ui'
import toast from 'react-hot-toast'

export default function SubAdminCommissionsPage() {
  const [commissions, setCommissions] = useState<any[]>([])
  const [meta,        setMeta]        = useState<any>(null)
  const [loading,     setLoading]     = useState(true)
  const [page,        setPage]        = useState(1)
  const [status,      setStatus]      = useState('')

  const fetch = (p = page) => {
    setLoading(true)
    subAdminApi.listCommissions({ page: p, status: status || undefined })
      .then(r => { setCommissions(r.data.data); setMeta(r.data.meta ?? r.data) })
      .catch(e => toast.error(e.response?.data?.message ?? 'Failed to load commissions.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetch(1); setPage(1) }, [status])
  useEffect(() => { fetch(page) }, [page])

  const statusColor: Record<string, any> = {
    pending: 'amber', paid: 'green', waived: 'blue', overdue: 'red',
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-light text-ink mb-1">Commissions</h1>
        <p className="text-sm text-stone">View commission records — read only.</p>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {['', 'pending', 'overdue', 'paid', 'waived'].map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-4 py-2 rounded-full text-xs font-semibold capitalize transition-all
              ${status === s ? 'bg-ink text-white' : 'bg-cream text-stone hover:text-ink'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-sand rounded-xl animate-pulse" />)}</div>
      ) : commissions.length === 0 ? (
        <div className="card">
          <EmptyState emoji="💰" title="No commissions found" description="No commissions match this filter." />
        </div>
      ) : (
        <div className="card">
          <Table>
            <thead>
              <tr>
                <Th>Seller</Th>
                <Th>Property</Th>
                <Th>Amount</Th>
                <Th>Rate</Th>
                <Th>Status</Th>
                <Th>Due Date</Th>
              </tr>
            </thead>
            <tbody>
              {commissions.map(c => (
                <tr key={c.id} className="hover:bg-cream/50 transition-colors">
                  <Td>
                    <p className="font-medium text-ink">{c.seller?.company_name ?? c.seller?.name}</p>
                    <p className="text-xs text-stone">{c.seller?.email}</p>
                  </Td>
                  <Td className="text-xs text-stone line-clamp-1 max-w-[150px]">{c.property?.title ?? '—'}</Td>
                  <Td className="font-semibold text-ink">{formatUGX(c.amount)}</Td>
                  <Td className="text-xs text-stone">{c.rate}%</Td>
                  <Td><Badge label={c.status} color={statusColor[c.status] ?? 'grey'} /></Td>
                  <Td className="text-xs text-stone">{c.due_date ? formatDate(c.due_date) : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {meta && <Pagination page={meta.current_page ?? page} lastPage={meta.last_page ?? 1} total={meta.total ?? commissions.length} onPage={setPage} />}
        </div>
      )}
    </div>
  )
}
