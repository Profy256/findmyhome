'use client'
import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { formatUGX, timeAgo, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { PageLoader, EmptyState, Table, Th, Td, Pagination, Badge, KycBadge, Modal, ConfirmDialog } from '@/components/ui'
import toast from 'react-hot-toast'

// ── ADMIN USERS ───────────────────────────────────────────────────────────────
export function AdminUsersPage() {
  const [users, setUsers]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage]       = useState(1)
  const [total, setTotal]     = useState(0)
  const [lastPage, setLastPage] = useState(1)
  const [search, setSearch]   = useState('')
  const [role, setRole]       = useState('')
  const [kyc, setKyc]         = useState('')
  const [acting, setActing]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await adminApi.users({ page, search: search||undefined, role: role||undefined, kyc_status: kyc||undefined })
      setUsers(r.data.data); setTotal(r.data.total); setLastPage(r.data.last_page)
    } catch {} finally { setLoading(false) }
  }, [page, search, role, kyc])

  useEffect(() => { load() }, [load])

  const block   = async (id: string) => { setActing(id); try { await adminApi.blockUser(id);   toast.success('User blocked.');   load() } catch { toast.error('Failed.') } finally { setActing(null) } }
  const unblock = async (id: string) => { setActing(id); try { await adminApi.unblockUser(id); toast.success('User unblocked.'); load() } catch { toast.error('Failed.') } finally { setActing(null) } }

  const roleColor = (r: string) => r==='admin'?'red':r==='company'?'blue':r==='seller'?'amber':'grey'

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-light text-ink">Users</h1>
        <p className="text-sm text-stone mt-1">{total} registered users</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key==='Enter'&&load()}
          placeholder="Search name, email, phone..." className="input max-w-xs py-2 text-sm" />
        <select value={role} onChange={e => setRole(e.target.value)} className="input max-w-[130px] py-2 text-sm">
          <option value="">All roles</option>
          <option value="buyer">Buyer</option><option value="seller">Seller</option>
          <option value="company">Company</option>
        </select>
        <select value={kyc} onChange={e => setKyc(e.target.value)} className="input max-w-[150px] py-2 text-sm">
          <option value="">All KYC</option>
          <option value="verified">Verified</option><option value="pending">Pending</option>
          <option value="rejected">Rejected</option><option value="blocked">Blocked</option>
        </select>
        <button onClick={() => { setPage(1); load() }} className="btn-primary py-2 px-4 text-sm">Search</button>
      </div>

      {loading ? <PageLoader /> : !users.length ? <EmptyState emoji="👤" title="No users found" /> : (
        <div className="bg-white rounded-xl border border-sand overflow-hidden">
          <Table>
            <thead><tr><Th>User</Th><Th>Role</Th><Th>KYC</Th><Th>Categories</Th><Th>Blue Badge</Th><Th>Joined</Th><Th>Actions</Th></tr></thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.id} className={cn('hover:bg-cream/50', u.kyc_status==='blocked'&&'bg-red-50/30')}>
                  <Td>
                    <p className="font-medium text-ink">{u.company_name ?? u.name}</p>
                    <p className="text-xs text-stone">{u.email}</p>
                    <p className="text-xs text-stone">{u.phone}</p>
                  </Td>
                  <Td><Badge label={u.role} color={roleColor(u.role) as any} /></Td>
                  <Td><KycBadge status={u.kyc_status} /></Td>
                  <Td>
                    {u.seller_categories?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {u.seller_categories.map((c: string) => (
                          <span key={c} className="text-[10px] bg-cream px-1.5 py-0.5 rounded text-stone capitalize">{c.replace('_',' ')}</span>
                        ))}
                      </div>
                    ) : <span className="text-xs text-dust">—</span>}
                  </Td>
                  <Td>
                    {u.blue_badge ? <Badge label="Active 🔵" color="blue" /> : <span className="text-xs text-dust">—</span>}
                  </Td>
                  <Td><span className="text-xs text-stone">{formatDate(u.created_at)}</span></Td>
                  <Td>
                    {u.role !== 'admin' && (
                      u.kyc_status === 'blocked'
                        ? <button onClick={() => unblock(u.id)} disabled={acting===u.id}
                            className="px-2.5 py-1 text-xs rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-50">
                            {acting===u.id?'...':'Unblock'}
                          </button>
                        : <button onClick={() => block(u.id)} disabled={acting===u.id}
                            className="px-2.5 py-1 text-xs rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-50">
                            {acting===u.id?'...':'Block'}
                          </button>
                    )}
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

// ── ADMIN PROPERTIES ──────────────────────────────────────────────────────────
export function AdminPropertiesPage() {
  const [props, setProps]       = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [page, setPage]         = useState(1)
  const [total, setTotal]       = useState(0)
  const [lastPage, setLastPage] = useState(1)
  const [status, setStatus]     = useState('')
  const [acting, setActing]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await adminApi.listProperties({ page, status: status||undefined })
      setProps(r.data.data); setTotal(r.data.total); setLastPage(r.data.last_page)
    } catch {} finally { setLoading(false) }
  }, [page, status])

  useEffect(() => { load() }, [load])

  const freeze      = async (id: string) => { setActing(id); try { await adminApi.freezeListing(id);   toast.success('Frozen.'); load() } catch { toast.error('Failed.') } finally { setActing(null) } }
  const unfreeze    = async (id: string) => { setActing(id); try { await adminApi.unfreezeListing(id); toast.success('Restored.'); load() } catch { toast.error('Failed.') } finally { setActing(null) } }
  const del         = async (id: string) => { if(!confirm('Delete this listing permanently?')) return; setActing(id); try { await adminApi.deleteListing(id); toast.success('Deleted.'); load() } catch { toast.error('Failed.') } finally { setActing(null) } }
  const verifyTitle = async (id: string) => { setActing(id); try { await adminApi.verifyTitle(id); toast.success('Land title verified.'); load() } catch { toast.error('Failed.') } finally { setActing(null) } }

  const statusColor = (s: string) => s==='active'?'green':s==='frozen'||s==='draft'?'amber':s==='sold'||s==='rented'?'blue':'grey'

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-light text-ink">Properties</h1>
        <p className="text-sm text-stone mt-1">{total} listings</p>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {['','active','frozen','sold','rented','draft'].map(s => (
          <button key={s} onClick={() => { setStatus(s); setPage(1) }}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${status===s?'bg-ink text-white border-ink':'bg-white text-stone border-sand hover:border-stone'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? <PageLoader /> : !props.length ? <EmptyState emoji="🏠" title="No properties found" /> : (
        <div className="bg-white rounded-xl border border-sand overflow-hidden">
          <Table>
            <thead><tr><Th>Property</Th><Th>Type</Th><Th>Seller</Th><Th>Price</Th><Th>Status</Th><Th>Actions</Th></tr></thead>
            <tbody>
              {props.map((p: any) => (
                <tr key={p.id} className="hover:bg-cream/50">
                  <Td>
                    <p className="font-medium text-ink line-clamp-1">{p.title}</p>
                    <p className="text-xs text-stone">{p.location}</p>
                    {p.property_type === 'land' && p.land_title_url && !p.land_title_verified && (
                      <span className="text-[10px] text-amber-600 font-semibold">⚠ Title needs verification</span>
                    )}
                  </Td>
                  <Td><span className="text-xs capitalize text-stone">{p.property_type?.replace(/_/g,' ')}</span></Td>
                  <Td>
                    <p className="text-sm text-ink">{p.seller?.company_name ?? p.seller?.name}</p>
                    <KycBadge status={p.seller?.kyc_status} />
                  </Td>
                  <Td><span className="font-medium text-sm">{formatUGX(p.price)}</span></Td>
                  <Td><Badge label={p.status} color={statusColor(p.status) as any} /></Td>
                  <Td>
                    <div className="flex gap-1.5 flex-wrap">
                      {p.status==='active'  && <button onClick={()=>freeze(p.id)}      disabled={acting===p.id} className="px-2 py-1 text-xs rounded bg-amber-50 text-amber-700 border border-amber-200 disabled:opacity-50">Freeze</button>}
                      {p.status==='frozen'  && <button onClick={()=>unfreeze(p.id)}    disabled={acting===p.id} className="px-2 py-1 text-xs rounded bg-green-50 text-green-700 border border-green-200 disabled:opacity-50">Restore</button>}
                      {p.property_type==='land' && p.land_title_url && !p.land_title_verified &&
                        <button onClick={()=>verifyTitle(p.id)} disabled={acting===p.id} className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-700 border border-blue-200 disabled:opacity-50">Verify Title</button>}
                      <button onClick={()=>del(p.id)} disabled={acting===p.id} className="px-2 py-1 text-xs rounded bg-red-50 text-red-600 border border-red-200 disabled:opacity-50">Delete</button>
                    </div>
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

// ── ADMIN COMMISSIONS ─────────────────────────────────────────────────────────
export function AdminCommissionsPage() {
  const [data, setData]         = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [page, setPage]         = useState(1)
  const [total, setTotal]       = useState(0)
  const [lastPage, setLastPage] = useState(1)
  const [status, setStatus]     = useState('')
  const [acting, setActing]     = useState<string|null>(null)
  const [waiveId, setWaiveId]   = useState<string|null>(null)
  const [reason, setReason]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await adminApi.listCommissions({ page, status: status||undefined })
      setData(r.data.data); setTotal(r.data.total); setLastPage(r.data.last_page)
    } catch {} finally { setLoading(false) }
  }, [page, status])

  useEffect(() => { load() }, [load])

  const markPaid = async (id: string) => {
    setActing(id)
    try { await adminApi.markCommissionPaid(id); toast.success('Marked paid.'); load() }
    catch { toast.error('Failed.') } finally { setActing(null) }
  }

  const waive = async () => {
    if (!waiveId || !reason.trim()) { toast.error('Enter a reason.'); return }
    setActing(waiveId)
    try { await adminApi.waiveCommission(waiveId, reason); toast.success('Waived.'); setWaiveId(null); setReason(''); load() }
    catch { toast.error('Failed.') } finally { setActing(null) }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-light text-ink">Commissions</h1>
        <p className="text-sm text-stone mt-1">{total} commission records</p>
      </div>

      <div className="flex gap-2 mb-6">
        {['','pending','reminded','overdue','paid'].map(s => (
          <button key={s} onClick={() => { setStatus(s); setPage(1) }}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${status===s?'bg-ink text-white border-ink':'bg-white text-stone border-sand'}`}>
            {s||'All'}
          </button>
        ))}
      </div>

      {loading ? <PageLoader /> : !data.length ? <EmptyState emoji="💰" title="No commissions found" /> : (
        <div className="bg-white rounded-xl border border-sand overflow-hidden">
          <Table>
            <thead><tr><Th>Seller</Th><Th>Sale Price</Th><Th>Commission</Th><Th>Reminders</Th><Th>Due</Th><Th>Status</Th><Th>Actions</Th></tr></thead>
            <tbody>
              {data.map((c: any) => (
                <tr key={c.id} className={cn('hover:bg-cream/50', c.status==='overdue'&&'bg-red-50/20')}>
                  <Td><p className="font-medium text-ink">{c.seller?.display_name}</p><p className="text-xs text-stone">{c.seller?.email}</p></Td>
                  <Td><span className="font-medium text-sm">{formatUGX(c.property_price)}</span></Td>
                  <Td><span className={cn('font-semibold', c.status==='overdue'?'text-red-500':'text-ink')}>{c.amount_formatted}</span></Td>
                  <Td><span className="text-xs text-stone">{c.reminder_count} / 3</span></Td>
                  <Td><span className={cn('text-sm', c.is_overdue?'text-red-500 font-semibold':'text-ink')}>{c.due_date}</span></Td>
                  <Td><Badge label={c.status} color={c.status==='paid'?'green':c.status==='overdue'?'red':c.status==='reminded'?'amber':'grey'} /></Td>
                  <Td>
                    {c.status !== 'paid' && (
                      <div className="flex gap-1.5">
                        <button onClick={()=>markPaid(c.id)} disabled={acting===c.id}
                          className="px-2 py-1 text-xs rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-50">
                          Mark Paid
                        </button>
                        <button onClick={()=>setWaiveId(c.id)}
                          className="px-2 py-1 text-xs rounded bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100">
                          Waive
                        </button>
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={page} lastPage={lastPage} onPage={setPage} total={total} />
        </div>
      )}

      <Modal open={!!waiveId} onClose={()=>setWaiveId(null)} title="Waive Commission" maxWidth="max-w-md">
        <p className="text-sm text-stone mb-4">Provide a reason. This will be logged in the audit trail.</p>
        <textarea value={reason} onChange={e=>setReason(e.target.value)}
          className="input h-24 resize-none mb-4" placeholder="Reason for waiving..." />
        <div className="flex gap-3 justify-end">
          <button onClick={()=>setWaiveId(null)} className="btn-outline py-2 px-4 text-sm">Cancel</button>
          <button onClick={waive} disabled={!!acting} className="btn-primary py-2 px-4 text-sm disabled:opacity-50">
            {acting ? 'Processing...' : 'Confirm Waive'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

// ── ADMIN LEADS ───────────────────────────────────────────────────────────────
export function AdminLeadsPage() {
  const [data, setData]         = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [page, setPage]         = useState(1)
  const [total, setTotal]       = useState(0)
  const [lastPage, setLastPage] = useState(1)
  const [method, setMethod]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await adminApi.listLeads({ page, method: method||undefined })
      setData(r.data.data); setTotal(r.data.total); setLastPage(r.data.last_page)
    } catch {} finally { setLoading(false) }
  }, [page, method])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-light text-ink">All Leads</h1>
        <p className="text-sm text-stone mt-1">{total} leads across the platform</p>
      </div>
      <div className="flex gap-2 mb-6">
        {[['','All'],['whatsapp','💬 WhatsApp'],['platform','📩 Platform']].map(([v,l])=>(
          <button key={v} onClick={()=>{setMethod(v);setPage(1)}}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${method===v?'bg-ink text-white border-ink':'bg-white text-stone border-sand'}`}>{l}</button>
        ))}
      </div>
      {loading ? <PageLoader /> : !data.length ? <EmptyState emoji="📭" title="No leads" /> : (
        <div className="bg-white rounded-xl border border-sand overflow-hidden">
          <Table>
            <thead><tr><Th>Buyer</Th><Th>Property</Th><Th>Seller</Th><Th>Channel</Th><Th>Date</Th></tr></thead>
            <tbody>
              {data.map((l:any)=>(
                <tr key={l.id} className="hover:bg-cream/50">
                  <Td><p className="font-medium text-ink">{l.buyer?.name}</p><p className="text-xs text-stone">{l.buyer?.phone}</p></Td>
                  <Td><p className="font-medium text-ink line-clamp-1">{l.property?.title}</p><p className="text-xs text-stone">{l.property?.location}</p></Td>
                  <Td><p className="text-sm text-ink">{l.seller?.display_name ?? l.seller?.name}</p></Td>
                  <Td><Badge label={l.contact_method==='whatsapp'?'💬 WhatsApp':'📩 Platform'} color={l.contact_method==='whatsapp'?'green':'blue'} /></Td>
                  <Td><span className="text-xs text-stone">{timeAgo(l.created_at)}</span></Td>
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

// ── ADMIN RATINGS ─────────────────────────────────────────────────────────────
export function AdminRatingsPage() {
  const [data, setData]       = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing]   = useState<string|null>(null)

  const load = async () => {
    setLoading(true)
    try { const r = await adminApi.listRatings(); setData(r.data.data ?? r.data) }
    catch {} finally { setLoading(false) }
  }
  useEffect(()=>{ load() },[])

  const hide = async (id:string) => { setActing(id); try { await adminApi.hideRating(id); toast.success('Hidden.'); load() } catch { toast.error('Failed.') } finally { setActing(null) } }
  const del  = async (id:string) => { if(!confirm('Delete permanently?')) return; setActing(id); try { await adminApi.deleteRating(id); toast.success('Deleted.'); load() } catch { toast.error('Failed.') } finally { setActing(null) } }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-light text-ink">Reviews</h1>
        <p className="text-sm text-stone mt-1">Moderate buyer reviews</p>
      </div>
      {loading ? <PageLoader /> : !data.length ? <EmptyState emoji="⭐" title="No reviews yet" /> : (
        <div className="bg-white rounded-xl border border-sand overflow-hidden">
          <Table>
            <thead><tr><Th>Buyer</Th><Th>Seller</Th><Th>Stars</Th><Th>Review</Th><Th>Visible</Th><Th>Actions</Th></tr></thead>
            <tbody>
              {data.map((r:any)=>(
                <tr key={r.id} className={cn('hover:bg-cream/50', !r.is_visible&&'opacity-50')}>
                  <Td><p className="font-medium text-ink">{r.buyer?.name}</p></Td>
                  <Td><p className="font-medium text-ink">{r.seller?.display_name ?? r.seller?.name}</p></Td>
                  <Td><span className="text-gold">{'⭐'.repeat(r.stars)}</span></Td>
                  <Td><p className="text-xs text-stone line-clamp-2 max-w-xs">{r.review || '—'}</p></Td>
                  <Td><Badge label={r.is_visible?'Visible':'Hidden'} color={r.is_visible?'green':'grey'} /></Td>
                  <Td>
                    <div className="flex gap-1.5">
                      {r.is_visible && <button onClick={()=>hide(r.id)} disabled={acting===r.id} className="px-2 py-1 text-xs rounded bg-amber-50 text-amber-700 border border-amber-200 disabled:opacity-50">Hide</button>}
                      <button onClick={()=>del(r.id)} disabled={acting===r.id} className="px-2 py-1 text-xs rounded bg-red-50 text-red-600 border border-red-200 disabled:opacity-50">Delete</button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  )
}
