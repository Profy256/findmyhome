'use client'
import { useEffect, useState } from 'react'
import { subAdminApi } from '@/lib/api'
import { formatUGX } from '@/lib/utils'
import { Badge, Table, Th, Td, Pagination, EmptyState } from '@/components/ui'
import toast from 'react-hot-toast'
import { Search } from 'lucide-react'

export default function SubAdminPropertiesPage() {
  const [props,   setProps]   = useState<any[]>([])
  const [meta,    setMeta]    = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [page,    setPage]    = useState(1)
  const [search,  setSearch]  = useState('')
  const [type,    setType]    = useState('')

  const fetch = (p = page) => {
    setLoading(true)
    subAdminApi.listProperties({ page: p, search: search || undefined, type: type || undefined })
      .then(r => { setProps(r.data.data); setMeta(r.data.meta ?? r.data) })
      .catch(e => toast.error(e.response?.data?.message ?? 'Failed to load properties.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetch(1); setPage(1) }, [search, type])
  useEffect(() => { fetch(page) }, [page])

  const TYPES = ['house', 'airbnb', 'lodge', 'rental', 'apartment', 'land']

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-light text-ink mb-1">Properties</h1>
        <p className="text-sm text-stone">View all platform listings — read only.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dust" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by title or location…" className="input pl-9" />
        </div>
        <select value={type} onChange={e => setType(e.target.value)} className="input max-w-[160px]">
          <option value="">All Types</option>
          {TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-sand rounded-xl animate-pulse" />)}</div>
      ) : props.length === 0 ? (
        <div className="card">
          <EmptyState emoji="🏠" title="No properties found" description="Adjust your search filters." />
        </div>
      ) : (
        <div className="card">
          <Table>
            <thead>
              <tr>
                <Th>Property</Th>
                <Th>Type</Th>
                <Th>Price</Th>
                <Th>Status</Th>
                <Th>Seller</Th>
              </tr>
            </thead>
            <tbody>
              {props.map(p => (
                <tr key={p.id} className="hover:bg-cream/50 transition-colors">
                  <Td>
                    <div>
                      <p className="font-medium text-ink line-clamp-1">{p.title}</p>
                      <p className="text-xs text-stone">{p.location}</p>
                    </div>
                  </Td>
                  <Td><span className="capitalize text-xs px-2 py-0.5 bg-cream rounded-full text-stone">{p.type}</span></Td>
                  <Td className="text-xs font-medium text-ink">{formatUGX(p.price)}</Td>
                  <Td>
                    <div className="flex flex-col gap-0.5">
                      <Badge
                        label={p.status === 'active' ? 'Active' : p.status === 'frozen' ? 'Frozen' : p.status}
                        color={p.status === 'active' ? 'green' : p.status === 'frozen' ? 'blue' : 'amber'}
                      />
                      {p.is_featured && <Badge label="Featured" color="gold" />}
                    </div>
                  </Td>
                  <Td className="text-xs text-stone">{p.seller?.company_name ?? p.seller?.name ?? '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {meta && <Pagination page={meta.current_page ?? page} lastPage={meta.last_page ?? 1} total={meta.total ?? props.length} onPage={setPage} />}
        </div>
      )}
    </div>
  )
}
