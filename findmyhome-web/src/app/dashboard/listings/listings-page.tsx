'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { propertiesApi } from '@/lib/api'
import { formatUGX, timeAgo } from '@/lib/utils'
import { Plus, Eye, MessageSquare, Pencil, Trash2, MapPin, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_COLORS: Record<string, string> = {
  active:  'bg-green-100 text-green-700',
  frozen:  'bg-amber-100 text-amber-700',
  sold:    'bg-blue-100 text-blue-700',
  rented:  'bg-purple-100 text-purple-700',
  draft:   'bg-gray-100 text-gray-600',
}

export default function ListingsPage() {
  const [listings, setListings] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    propertiesApi.mine().then(r => setListings(r.data.data ?? [])).finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    setDeleting(id)
    try {
      await propertiesApi.delete(id)
      setListings(prev => prev.filter(p => p.id !== id))
      toast.success('Listing deleted.')
    } catch { toast.error('Could not delete listing.') }
    finally { setDeleting(null) }
  }

  if (loading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-sand rounded-xl animate-pulse" />)}</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-light text-ink mb-1">My Listings</h1>
          <p className="text-sm text-stone">{listings.length} total listings</p>
        </div>
        <Link href="/dashboard/listings/new" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Listing
        </Link>
      </div>

      {listings.length === 0 ? (
        <div className="text-center py-16 card">
          <div className="text-4xl mb-4">🏠</div>
          <h3 className="text-lg font-medium text-ink mb-2">No listings yet</h3>
          <p className="text-sm text-stone mb-6">Add your first property to start receiving leads from buyers.</p>
          <Link href="/dashboard/listings/new" className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add First Listing
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map(p => (
            <div key={p.id} className="card p-5 flex items-center gap-5">
              {/* Icon/photo */}
              <div className="w-16 h-16 rounded-xl bg-ink flex items-center justify-center flex-shrink-0 text-2xl overflow-hidden">
                {p.photos?.[0] ? <img src={p.photos[0]} alt="" className="w-full h-full object-cover" /> : '🏠'}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-medium text-ink text-sm truncate">{p.title}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {p.status}
                  </span>
                  {!p.passes_land_title_check && (
                    <span className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      <AlertCircle className="w-3 h-3" /> Title needed
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-stone">
                  <MapPin className="w-3 h-3" />{p.location}
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-sm font-semibold text-ink">{formatUGX(p.price)}</span>
                  <span className="flex items-center gap-1 text-xs text-stone">
                    <MessageSquare className="w-3 h-3" /> {p.leads_count ?? 0} leads
                  </span>
                  <span className="text-xs text-dust">{timeAgo(p.created_at)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <Link href={`/properties/${p.id}`} className="w-8 h-8 rounded-lg border border-sand flex items-center justify-center hover:bg-cream transition-colors">
                  <Eye className="w-4 h-4 text-stone" />
                </Link>
                <Link href={`/dashboard/listings/${p.id}`} className="w-8 h-8 rounded-lg border border-sand flex items-center justify-center hover:bg-cream transition-colors">
                  <Pencil className="w-4 h-4 text-stone" />
                </Link>
                <button onClick={() => handleDelete(p.id, p.title)} disabled={deleting === p.id}
                  className="w-8 h-8 rounded-lg border border-sand flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition-colors">
                  <Trash2 className="w-4 h-4 text-stone hover:text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
