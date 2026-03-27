'use client'
import { use, useEffect, useState } from 'react'
import { notFound } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { PropertyCard } from '@/components/properties/PropertyCard'
import { propertiesApi, ratingsApi } from '@/lib/api'
import api from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { PageLoader, EmptyState } from '@/components/ui'
import Link from 'next/link'

export default function SellerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [seller,   setSeller]   = useState<any>(null)
  const [listings, setListings] = useState<any[]>([])
  const [reviews,  setReviews]  = useState<any>(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [sellerRes, listingsRes, reviewsRes] = await Promise.all([
          api.get(`/auth/me`).catch(() => api.get(`/properties?seller_id=${id}&page=1`)),
          propertiesApi.list({ seller_id: id }),
          ratingsApi.seller(id),
        ])
        setListings(listingsRes.data.data ?? [])
        setReviews(reviewsRes.data)

        // Get seller info from first listing
        if (listingsRes.data.data?.[0]?.seller) {
          setSeller(listingsRes.data.data[0].seller)
        }
      } catch {} finally { setLoading(false) }
    }
    load()
  }, [id])

  if (loading) return <><Navbar /><PageLoader /></>

  const starBreakdown = reviews?.breakdown ?? {}
  const avgRating     = reviews?.seller?.average_rating ?? 0
  const totalReviews  = reviews?.seller?.total_reviews  ?? 0

  return (
    <>
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-3 gap-10">

          {/* LEFT — seller info */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-sand rounded-2xl p-6 sticky top-24">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-ink flex items-center justify-center mb-4">
                  <span className="text-white text-2xl font-display font-semibold">
                    {(seller?.company_name ?? seller?.name)?.[0]}
                  </span>
                </div>
                <h1 className="font-display text-2xl font-light text-ink">
                  {seller?.company_name ?? seller?.name}
                  {seller?.blue_badge && <span className="ml-2 text-blue-400">🔵</span>}
                </h1>
                <p className="text-sm text-forest font-semibold mt-1">
                  {seller?.role === 'company' ? 'Registered Business ✔' : 'Identity Verified ✔'}
                </p>
              </div>

              {/* Rating */}
              {totalReviews > 0 && (
                <div className="text-center mb-6 pb-6 border-b border-sand">
                  <div className="font-display text-4xl font-light text-ink">{avgRating}</div>
                  <div className="text-gold text-lg mt-1">{'⭐'.repeat(Math.round(avgRating))}</div>
                  <div className="text-xs text-stone mt-1">{totalReviews} verified reviews</div>
                  {/* Star breakdown */}
                  <div className="mt-4 space-y-1.5">
                    {[5,4,3,2,1].map(star => (
                      <div key={star} className="flex items-center gap-2">
                        <span className="text-xs text-stone w-4">{star}</span>
                        <div className="flex-1 h-1.5 bg-sand rounded-full overflow-hidden">
                          <div className="h-full bg-gold rounded-full transition-all"
                            style={{ width: `${starBreakdown[star]?.percentage ?? 0}%` }} />
                        </div>
                        <span className="text-xs text-dust w-6">{starBreakdown[star]?.count ?? 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2 text-sm text-stone">
                <p>📋 {listings.length} active listing{listings.length !== 1 ? 's' : ''}</p>
                {seller?.seller_categories?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {seller.seller_categories.map((cat: string) => (
                      <span key={cat} className="text-[10px] bg-cream text-stone px-2 py-1 rounded capitalize">
                        {cat.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT — listings + reviews */}
          <div className="lg:col-span-2 space-y-12">

            {/* Listings */}
            <div>
              <h2 className="font-display text-2xl font-light text-ink mb-6">
                Active Listings ({listings.length})
              </h2>
              {listings.length === 0 ? (
                <EmptyState emoji="🏠" title="No active listings" />
              ) : (
                <div className="grid sm:grid-cols-2 gap-6">
                  {listings.map(p => <PropertyCard key={p.id} property={p} />)}
                </div>
              )}
            </div>

            {/* Reviews */}
            <div>
              <h2 className="font-display text-2xl font-light text-ink mb-6">
                Buyer Reviews ({totalReviews})
              </h2>
              {reviews?.reviews?.data?.length === 0 ? (
                <EmptyState emoji="⭐" title="No reviews yet" description="This seller has not been reviewed yet." />
              ) : (
                <div className="space-y-4">
                  {(reviews?.reviews?.data ?? []).map((r: any) => (
                    <div key={r.id} className="bg-white border border-sand rounded-xl p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-medium text-ink text-sm">{r.buyer?.name}</p>
                          {r.property?.title && (
                            <p className="text-xs text-stone mt-0.5">Re: {r.property.title}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-gold text-sm">{'⭐'.repeat(r.stars)}</div>
                          <div className="text-xs text-dust mt-1">{r.created_at_full}</div>
                        </div>
                      </div>
                      {r.review && (
                        <p className="text-sm text-stone leading-relaxed">{r.review}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
