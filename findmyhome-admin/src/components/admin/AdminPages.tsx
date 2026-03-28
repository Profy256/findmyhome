'use client'
import { useEffect, useState } from 'react'
import { adminApi } from '@/lib/api'
import { formatUGX, formatDate, timeAgo } from '@/lib/utils'
import { Badge, KycBadge, Table, Th, Td, Pagination, Modal, EmptyState, ConfirmDialog } from '@/components/ui'
import toast from 'react-hot-toast'
import {
  Users, Search, Ban, ShieldCheck, Trash2, Star, Shield,
  Home, Snowflake, Sun, Eye, DollarSign, CheckCircle2,
  XCircle, MessageSquare, Award, ChevronDown, MoreHorizontal,
} from 'lucide-react'

// ────────────────────────────────────────────────────────────────────────────
// USERS PAGE
// ────────────────────────────────────────────────────────────────────────────
export function AdminUsersPage() {
  const [users,   setUsers]   = useState<any[]>([])
  const [meta,    setMeta]    = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [page,    setPage]    = useState(1)
  const [search,  setSearch]  = useState('')
  const [role,    setRole]    = useState('')
  const [acting,  setActing]  = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ type: string; user: any } | null>(null)
  const [detail,  setDetail]  = useState<any>(null)
  const [badgeDays, setBadgeDays] = useState('30')

  const fetch = (p = page) => {
    setLoading(true)
    adminApi.users({ page: p, search: search || undefined, role: role || undefined })
      .then(r => { setUsers(r.data.data); setMeta(r.data.meta ?? r.data) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetch(1); setPage(1) }, [search, role])
  useEffect(() => { fetch(page) }, [page])

  const doBlock = async (user: any) => {
    setActing(user.id)
    try {
      await adminApi.blockUser(user.id)
      toast.success(`${user.name} blocked.`)
      fetch()
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Failed.') }
    finally { setActing(null); setConfirm(null) }
  }
  const doUnblock = async (user: any) => {
    setActing(user.id)
    try {
      await adminApi.unblockUser(user.id)
      toast.success(`${user.name} unblocked.`)
      fetch()
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Failed.') }
    finally { setActing(null); setConfirm(null) }
  }
  const doDelete = async (user: any) => {
    setActing(user.id)
    try {
      await adminApi.deleteUser(user.id)
      toast.success(`${user.name} deleted.`)
      fetch()
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Failed.') }
    finally { setActing(null); setConfirm(null) }
  }
  const doGrantBadge = async (userId: string) => {
    const days = parseInt(badgeDays) || 30
    setActing(userId)
    try {
      await adminApi.grantBadge(userId, days)
      toast.success(`Blue Badge granted for ${days} days.`)
      fetch()
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Failed.') }
    finally { setActing(null) }
  }
  const doRevokeBadge = async (userId: string) => {
    setActing(userId)
    try {
      await adminApi.revokeBadge(userId)
      toast.success('Blue Badge revoked.')
      fetch()
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Failed.') }
    finally { setActing(null) }
  }

  const ROLES = ['buyer', 'seller', 'company', 'admin']

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-light text-ink mb-1">Users</h1>
        <p className="text-sm text-stone">Manage platform users, roles, and access.</p>
      </div>

      {/* Filters */}
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
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button onClick={() => setDetail(u)}
                        className="px-2.5 py-1.5 text-xs border border-sand rounded-lg hover:bg-cream flex items-center gap-1">
                        <Eye className="w-3 h-3" /> View
                      </button>
                      {u.is_blocked ? (
                        <button onClick={() => setConfirm({ type: 'unblock', user: u })} disabled={acting === u.id}
                          className="px-2.5 py-1.5 text-xs bg-forest text-white rounded-lg hover:opacity-90 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> Unblock
                        </button>
                      ) : (
                        <button onClick={() => setConfirm({ type: 'block', user: u })} disabled={acting === u.id}
                          className="px-2.5 py-1.5 text-xs bg-amber-500 text-white rounded-lg hover:opacity-90 flex items-center gap-1">
                          <Ban className="w-3 h-3" /> Block
                        </button>
                      )}
                      <button onClick={() => setConfirm({ type: 'delete', user: u })} disabled={acting === u.id}
                        className="px-2.5 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:opacity-90 flex items-center gap-1">
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {meta && <Pagination page={meta.current_page ?? page} lastPage={meta.last_page ?? 1} total={meta.total ?? users.length} onPage={setPage} />}
        </div>
      )}

      {/* User detail modal */}
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
            {/* Blue Badge management */}
            <div className="border border-sand rounded-xl p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-dust mb-3">Blue Badge</p>
              {detail.blue_badge ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-blue-500 font-semibold flex items-center gap-1"><Award className="w-4 h-4" /> Active</span>
                  <button onClick={() => doRevokeBadge(detail.id)} disabled={acting === detail.id}
                    className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:opacity-90">Revoke Badge</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input type="number" value={badgeDays} onChange={e => setBadgeDays(e.target.value)} min={1} max={365}
                    className="input max-w-[80px] py-1.5 text-sm" placeholder="Days" />
                  <span className="text-xs text-stone">days</span>
                  <button onClick={() => doGrantBadge(detail.id)} disabled={acting === detail.id}
                    className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:opacity-90">Grant Badge</button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={confirm?.type === 'block'}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && doBlock(confirm.user)}
        title="Block User"
        message={`Are you sure you want to block ${confirm?.user?.name}? They will not be able to log in.`}
        confirmLabel="Block User"
        danger
        loading={acting === confirm?.user?.id}
      />
      <ConfirmDialog
        open={confirm?.type === 'unblock'}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && doUnblock(confirm.user)}
        title="Unblock User"
        message={`Unblock ${confirm?.user?.name}? They will regain access to the platform.`}
        confirmLabel="Unblock"
        loading={acting === confirm?.user?.id}
      />
      <ConfirmDialog
        open={confirm?.type === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && doDelete(confirm.user)}
        title="Delete User"
        message={`Permanently delete ${confirm?.user?.name}? This cannot be undone.`}
        confirmLabel="Delete Permanently"
        danger
        loading={acting === confirm?.user?.id}
      />
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// PROPERTIES PAGE
// ────────────────────────────────────────────────────────────────────────────
export function AdminPropertiesPage() {
  const [props,   setProps]   = useState<any[]>([])
  const [meta,    setMeta]    = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [page,    setPage]    = useState(1)
  const [search,  setSearch]  = useState('')
  const [type,    setType]    = useState('')
  const [acting,  setActing]  = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ type: string; prop: any } | null>(null)
  const [freezeReason, setFreezeReason] = useState('')

  const fetch = (p = page) => {
    setLoading(true)
    adminApi.listProperties({ page: p, search: search || undefined, type: type || undefined })
      .then(r => { setProps(r.data.data); setMeta(r.data.meta ?? r.data) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetch(1); setPage(1) }, [search, type])
  useEffect(() => { fetch(page) }, [page])

  const doFreeze = async (prop: any) => {
    setActing(prop.id)
    try {
      await adminApi.freezeListing(prop.id, freezeReason || undefined)
      toast.success('Property frozen.')
      setFreezeReason('')
      fetch()
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Failed.') }
    finally { setActing(null); setConfirm(null) }
  }
  const doUnfreeze = async (prop: any) => {
    setActing(prop.id)
    try {
      await adminApi.unfreezeListing(prop.id)
      toast.success('Property unfrozen.')
      fetch()
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Failed.') }
    finally { setActing(null); setConfirm(null) }
  }
  const doDelete = async (prop: any) => {
    setActing(prop.id)
    try {
      await adminApi.deleteListing(prop.id)
      toast.success('Property deleted.')
      fetch()
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Failed.') }
    finally { setActing(null); setConfirm(null) }
  }

  const TYPES = ['house', 'airbnb', 'lodge', 'rental', 'apartment', 'land']

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-light text-ink mb-1">Properties</h1>
        <p className="text-sm text-stone">Review, freeze, feature or remove listings.</p>
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
                <Th>Actions</Th>
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
                  <Td>
                    <div className="flex gap-1.5 flex-wrap">
                      {p.status !== 'frozen' ? (
                        <button onClick={() => setConfirm({ type: 'freeze', prop: p })} disabled={acting === p.id}
                          className="px-2.5 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:opacity-90 flex items-center gap-1">
                          <Snowflake className="w-3 h-3" /> Freeze
                        </button>
                      ) : (
                        <button onClick={() => { setConfirm({ type: 'unfreeze', prop: p }) }} disabled={acting === p.id}
                          className="px-2.5 py-1.5 text-xs bg-forest text-white rounded-lg hover:opacity-90 flex items-center gap-1">
                          <Sun className="w-3 h-3" /> Unfreeze
                        </button>
                      )}
                      <button onClick={() => setConfirm({ type: 'delete', prop: p })} disabled={acting === p.id}
                        className="px-2.5 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:opacity-90 flex items-center gap-1">
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {meta && <Pagination page={meta.current_page ?? page} lastPage={meta.last_page ?? 1} total={meta.total ?? props.length} onPage={setPage} />}
        </div>
      )}

      {/* Freeze with reason */}
      <Modal open={confirm?.type === 'freeze'} onClose={() => setConfirm(null)} title="Freeze Listing" maxWidth="max-w-md">
        <p className="text-sm text-stone mb-4">Freeze <strong>{confirm?.prop?.title}</strong>? Optionally provide a reason.</p>
        <textarea value={freezeReason} onChange={e => setFreezeReason(e.target.value)} rows={2}
          placeholder="Reason (optional)…" className="input resize-none mb-4 text-sm" />
        <div className="flex gap-3">
          <button onClick={() => confirm && doFreeze(confirm.prop)} disabled={acting === confirm?.prop?.id}
            className="px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-lg hover:opacity-90">
            {acting === confirm?.prop?.id ? 'Freezing…' : 'Freeze Listing'}
          </button>
          <button onClick={() => setConfirm(null)} className="px-4 py-2 border border-sand text-stone text-sm rounded-lg hover:bg-cream">Cancel</button>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirm?.type === 'unfreeze'}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && doUnfreeze(confirm.prop)}
        title="Unfreeze Listing"
        message={`Unfreeze "${confirm?.prop?.title}"? It will be visible to buyers again.`}
        confirmLabel="Unfreeze"
        loading={acting === confirm?.prop?.id}
      />
      <ConfirmDialog
        open={confirm?.type === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && doDelete(confirm.prop)}
        title="Delete Listing"
        message={`Permanently delete "${confirm?.prop?.title}"? This cannot be undone.`}
        confirmLabel="Delete Permanently"
        danger
        loading={acting === confirm?.prop?.id}
      />
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// COMMISSIONS PAGE
// ────────────────────────────────────────────────────────────────────────────
export function AdminCommissionsPage() {
  const [commissions, setCommissions] = useState<any[]>([])
  const [meta,        setMeta]        = useState<any>(null)
  const [loading,     setLoading]     = useState(true)
  const [page,        setPage]        = useState(1)
  const [status,      setStatus]      = useState('')
  const [acting,      setActing]      = useState<string | null>(null)
  const [waiveId,     setWaiveId]     = useState<string | null>(null)
  const [waiveReason, setWaiveReason] = useState('')

  const fetch = (p = page) => {
    setLoading(true)
    adminApi.listCommissions({ page: p, status: status || undefined })
      .then(r => { setCommissions(r.data.data); setMeta(r.data.meta ?? r.data) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetch(1); setPage(1) }, [status])
  useEffect(() => { fetch(page) }, [page])

  const markPaid = async (id: string) => {
    setActing(id)
    try {
      await adminApi.markCommissionPaid(id)
      toast.success('Commission marked as paid.')
      fetch()
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Failed.') }
    finally { setActing(null) }
  }
  const waive = async (id: string) => {
    if (!waiveReason.trim()) { toast.error('Please enter a waiver reason.'); return }
    setActing(id)
    try {
      await adminApi.waiveCommission(id, waiveReason)
      toast.success('Commission waived.')
      setWaiveId(null); setWaiveReason('')
      fetch()
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Failed.') }
    finally { setActing(null) }
  }

  const statusColor: Record<string, any> = {
    pending: 'amber', paid: 'green', waived: 'blue', overdue: 'red',
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-light text-ink mb-1">Commissions</h1>
        <p className="text-sm text-stone">Track and collect seller commission fees.</p>
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
                <Th>Actions</Th>
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
                  <Td>
                    {c.status === 'pending' || c.status === 'overdue' ? (
                      <div className="flex gap-1.5 flex-wrap">
                        <button onClick={() => markPaid(c.id)} disabled={acting === c.id}
                          className="px-2.5 py-1.5 text-xs bg-forest text-white rounded-lg hover:opacity-90 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Mark Paid
                        </button>
                        <button onClick={() => setWaiveId(c.id)}
                          className="px-2.5 py-1.5 text-xs border border-sand text-stone rounded-lg hover:bg-cream flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Waive
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-dust">—</span>
                    )}
                    {/* Waive form */}
                    {waiveId === c.id && (
                      <div className="mt-2 space-y-2">
                        <textarea value={waiveReason} onChange={e => setWaiveReason(e.target.value)} rows={2}
                          placeholder="Reason for waiving…" className="input resize-none text-xs" />
                        <div className="flex gap-2">
                          <button onClick={() => waive(c.id)} disabled={acting === c.id}
                            className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded-lg hover:opacity-90">
                            {acting === c.id ? 'Waiving…' : 'Confirm Waive'}
                          </button>
                          <button onClick={() => { setWaiveId(null); setWaiveReason('') }}
                            className="px-3 py-1.5 text-xs border border-sand text-stone rounded-lg hover:bg-cream">Cancel</button>
                        </div>
                      </div>
                    )}
                  </Td>
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

// ────────────────────────────────────────────────────────────────────────────
// RATINGS PAGE
// ────────────────────────────────────────────────────────────────────────────
export function AdminRatingsPage() {
  const [ratings, setRatings] = useState<any[]>([])
  const [meta,    setMeta]    = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [page,    setPage]    = useState(1)
  const [acting,  setActing]  = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ type: string; rating: any } | null>(null)

  const fetch = (p = page) => {
    setLoading(true)
    adminApi.listRatings({ page: p })
      .then(r => { setRatings(r.data.data); setMeta(r.data.meta ?? r.data) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetch(page) }, [page])

  const doHide = async (rating: any) => {
    setActing(rating.id)
    try {
      await adminApi.hideRating(rating.id)
      toast.success('Review hidden from public view.')
      fetch()
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Failed.') }
    finally { setActing(null); setConfirm(null) }
  }
  const doDelete = async (rating: any) => {
    setActing(rating.id)
    try {
      await adminApi.deleteRating(rating.id)
      toast.success('Review deleted permanently.')
      fetch()
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Failed.') }
    finally { setActing(null); setConfirm(null) }
  }

  const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n)

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-light text-ink mb-1">Reviews</h1>
        <p className="text-sm text-stone">Moderate buyer reviews and ratings.</p>
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
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  {!r.hidden && (
                    <button onClick={() => setConfirm({ type: 'hide', rating: r })} disabled={acting === r.id}
                      className="px-2.5 py-1.5 text-xs border border-sand rounded-lg hover:bg-cream text-stone flex items-center gap-1">
                      <Eye className="w-3 h-3" /> Hide
                    </button>
                  )}
                  <button onClick={() => setConfirm({ type: 'delete', rating: r })} disabled={acting === r.id}
                    className="px-2.5 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:opacity-90 flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
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

      <ConfirmDialog
        open={confirm?.type === 'hide'}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && doHide(confirm.rating)}
        title="Hide Review"
        message="This review will be hidden from public view but not deleted."
        confirmLabel="Hide Review"
        loading={acting === confirm?.rating?.id}
      />
      <ConfirmDialog
        open={confirm?.type === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && doDelete(confirm.rating)}
        title="Delete Review"
        message="Permanently delete this review? This cannot be undone."
        confirmLabel="Delete Permanently"
        danger
        loading={acting === confirm?.rating?.id}
      />
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// LEADS PAGE
// ────────────────────────────────────────────────────────────────────────────
export function AdminLeadsPage() {
  const [leads,   setLeads]   = useState<any[]>([])
  const [meta,    setMeta]    = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [page,    setPage]    = useState(1)
  const [type,    setType]    = useState('')

  const fetch = (p = page) => {
    setLoading(true)
    adminApi.listLeads({ page: p, method: type || undefined })
      .then(r => { setLeads(r.data.data); setMeta(r.data.meta ?? r.data) })
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
        <p className="text-sm text-stone">All buyer enquiries and WhatsApp contacts across the platform.</p>
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
