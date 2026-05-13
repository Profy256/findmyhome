'use client'
import { useEffect, useState } from 'react'
import { subAdminApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { KycBadge, Table, Th, Td, Pagination, EmptyState, Modal } from '@/components/ui'
import toast from 'react-hot-toast'
import { Users, Search, Award, Eye } from 'lucide-react'

export default function SubAdminUsersPage() {
  const [users,    setUsers]    = useState<any[]>([])
  const [meta,     setMeta]     = useState<any>(null)
  const [loading,  setLoading]  = useState(true)
  const [page,     setPage]     = useState(1)
  const [search,   setSearch]   = useState('')
  const [role,     setRole]     = useState('')
  const [acting,   setActing]   = useState<string | null>(null)
  const [detail,   setDetail]   = useState<any>(null)
  const [badgeDays, setBadgeDays] = useState('30')

  const fetch = (p = page) => {
    setLoading(true)
    subAdminApi.users({ page: p, search: search || undefined, role: role || undefined })
      .then(r => { setUsers(r.data.data); setMeta(r.data.meta ?? r.data) })
      .catch(e => toast.error(e.response?.data?.message ?? 'Failed to load users.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetch(1); setPage(1) }, [search, role])
  useEffect(() => { fetch(page) }, [page])

  const doGrantBadge = async (userId: string) => {
    const days = parseInt(badgeDays) || 30
    setActing(userId)
    try {
      await subAdminApi.grantBadge(userId, days)
      toast.success(`Blue Badge granted for ${days} days.`)
      fetch()
      setDetail(null)
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Failed.') }
    finally { setActing(null) }
  }

  const ROLES = ['buyer', 'seller', 'company', 'admin', 'sub_admin']

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-light text-ink mb-1">Users</h1>
        <p className="text-sm text-stone">View users and grant blue badges.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dust" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email or phone…"
            className="input pl-9" />
        </div>
        <select value={role} onChange={e => setRole(e.target.value)} className="input max-w-[160px]">
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-sand rounded-xl animate-pulse" />)}</div>
      ) : users.length === 0 ? (
        <div className="card">
          <EmptyState emoji="👤" title="No users found" description="Try adjusting your search or filters." />
        </div>
      ) : (
        <div className="card">
          <Table>
            <thead>
              <tr>
                <Th>User</Th>
                <Th>Role</Th>
                <Th>KYC</Th>
                <Th>Blue Badge</Th>
                <Th>Joined</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="hover:bg-cream/50 transition-colors">
                  <Td>
                    <div>
                      <p className="font-medium text-ink">{u.company_name ?? u.name}</p>
                      <p className="text-xs text-stone">{u.email}</p>
                      {u.phone && <p className="text-xs text-dust">{u.phone}</p>}
                    </div>
                  </Td>
                  <Td>
                    <span className="capitalize text-xs font-medium px-2 py-0.5 bg-cream rounded-full text-stone">{u.role}</span>
                    {u.is_blocked && <span className="ml-1 text-xs text-red-500 font-semibold">BLOCKED</span>}
                  </Td>
                  <Td><KycBadge status={u.kyc_status ?? 'none'} /></Td>
                  <Td>
                    {u.blue_badge ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-500">
                        <Award className="w-3.5 h-3.5" /> Active
                      </span>
                    ) : (
                      <span className="text-xs text-dust">—</span>
                    )}
                  </Td>
                  <Td className="text-xs text-stone">{formatDate(u.created_at)}</Td>
                  <Td>
                    <button onClick={() => setDetail(u)}
                      className="px-2.5 py-1.5 text-xs border border-sand rounded-lg hover:bg-cream flex items-center gap-1">
                      <Eye className="w-3 h-3" /> View
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {meta && <Pagination page={meta.current_page ?? page} lastPage={meta.last_page ?? 1} total={meta.total ?? users.length} onPage={setPage} />}
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title="User Details" maxWidth="max-w-xl">
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-ink flex items-center justify-center">
                <span className="text-white text-xl font-semibold">{detail.name?.[0]}</span>
              </div>
              <div>
                <p className="font-semibold text-ink text-lg">{detail.company_name ?? detail.name}</p>
                <p className="text-sm text-stone">{detail.email} · {detail.phone}</p>
                <div className="flex gap-2 mt-1">
                  <span className="capitalize text-xs font-medium px-2 py-0.5 bg-cream rounded-full text-stone">{detail.role}</span>
                  <KycBadge status={detail.kyc_status ?? 'none'} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-cream rounded-lg p-3">
                <p className="text-[10px] text-dust uppercase tracking-wide mb-1">Average Rating</p>
                <p className="font-semibold text-ink">⭐ {detail.average_rating ?? '—'} ({detail.total_reviews ?? 0} reviews)</p>
              </div>
              <div className="bg-cream rounded-lg p-3">
                <p className="text-[10px] text-dust uppercase tracking-wide mb-1">Joined</p>
                <p className="font-semibold text-ink">{formatDate(detail.created_at)}</p>
              </div>
            </div>

            <div className="border border-sand rounded-xl p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-dust mb-3">Grant Blue Badge</p>
              {detail.blue_badge ? (
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-blue-500 font-semibold">Blue Badge Active</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input type="number" value={badgeDays} onChange={e => setBadgeDays(e.target.value)} min={1} max={365}
                    className="input max-w-[80px] py-1.5 text-sm" placeholder="Days" />
                  <span className="text-xs text-stone">days</span>
                  <button onClick={() => doGrantBadge(detail.id)} disabled={acting === detail.id}
                    className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:opacity-90">
                    {acting === detail.id ? 'Granting…' : 'Grant Badge'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
