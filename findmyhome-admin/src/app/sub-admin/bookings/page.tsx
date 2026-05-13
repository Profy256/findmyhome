'use client'
import { useEffect, useState, useCallback } from 'react'
import { subAdminApi } from '@/lib/api'
import { formatUGX } from '@/lib/utils'
import { PageLoader, EmptyState, Table, Th, Td, Pagination, Badge } from '@/components/ui'
import toast from 'react-hot-toast'

export default function SubAdminBookingsPage() {
  const [data,     setData]     = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [page,     setPage]     = useState(1)
  const [total,    setTotal]    = useState(0)
  const [lastPage, setLastPage] = useState(1)
  const [status,   setStatus]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await subAdminApi.listBookings({ page, status: status || undefined })
      setData(r.data.data); setTotal(r.data.total); setLastPage(r.data.last_page)
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to load bookings.')
    } finally { setLoading(false) }
  }, [page, status])

  useEffect(() => { load() }, [load])

  const statusColor = (s: string) =>
    s === 'confirmed' ? 'green' : s === 'rejected' || s === 'cancelled' ? 'red' :
    s === 'completed' ? 'blue' : 'amber'

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-light text-ink">Bookings</h1>
        <p className="text-sm text-stone mt-1">{total} total bookings — read only</p>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {['', 'pending', 'confirmed', 'rejected', 'completed', 'cancelled'].map(s => (
          <button key={s} onClick={() => { setStatus(s); setPage(1) }}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-all
              ${status === s ? 'bg-ink text-white border-ink' : 'bg-white text-stone border-sand hover:border-stone'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? <PageLoader /> : !data.length ? (
        <EmptyState emoji="📅" title="No bookings found" />
      ) : (
        <div className="bg-white rounded-xl border border-sand overflow-hidden">
          <Table>
            <thead>
              <tr>
                <Th>Guest</Th>
                <Th>Property</Th>
                <Th>Dates</Th>
                <Th>Amount</Th>
                <Th>Payment</Th>
                <Th>Status</Th>
              </tr>
            </thead>
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
                    <p className="text-xs text-dust">Seller: {b.property?.seller?.name}</p>
                  </Td>
                  <Td>
                    <p className="text-xs font-medium text-ink">{b.checkin_date} → {b.checkout_date}</p>
                    <p className="text-xs text-stone">{b.nights} nights · {b.guests} guests</p>
                  </Td>
                  <Td>
                    <p className="font-semibold text-sm text-ink">{formatUGX(b.total_price)}</p>
                    <p className="text-xs text-stone">Fee: {formatUGX(b.platform_fee)}</p>
                  </Td>
                  <Td>
                    <Badge label={b.payment_status} color={b.payment_status === 'paid' ? 'green' : 'amber'} />
                  </Td>
                  <Td>
                    <Badge label={b.status} color={statusColor(b.status) as any} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={page} lastPage={lastPage} onPage={setPage} total={total} />
        </div>
      )}
    </div>
  )
}
