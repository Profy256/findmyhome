'use client'
import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Navbar } from '@/components/layout/Navbar'
import { propertiesApi, ratingsApi, leadsApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { formatUGX, buildWhatsAppUrl, buildWhatsAppMessage, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import { MapPin, Bed, Bath, Ruler, Star, Phone, MessageCircle, Send, Map, Shield, CheckCircle2, Users } from 'lucide-react'

const AMENITY_ICONS: Record<string, string> = {
  'WiFi': '📶', 'DSTV': '📺', 'Parking': '🚗', 'Security': '🔒',
  'Kitchen': '🍳', 'Hot Water': '🚿', 'Garden': '🌿', 'Pool': '🏊',
  'Generator': '⚡', 'Borehole': '💧', 'Breakfast': '🍳', 'Airport Transfer': '✈️',
}

export default function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user, isAuthenticated } = useAuthStore()
  const router = useRouter()

  const [property,   setProperty]   = useState<any>(null)
  const [ratings,    setRatings]    = useState<any>(null)
  const [loading,    setLoading]    = useState(true)
  const [activeImg,  setActiveImg]  = useState(0)
  const [enquiring,  setEnquiring]  = useState(false)
  const [canRate,    setCanRate]    = useState<any>(null)
  const [showReview, setShowReview] = useState(false)
  const [stars,      setStars]      = useState(0)
  const [review,     setReview]     = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([
      propertiesApi.get(id),
      ratingsApi.seller(id).catch(() => null),
    ]).then(([pRes, rRes]) => {
      setProperty(pRes.data)
      setRatings(rRes?.data)
    }).finally(() => setLoading(false))

    if (isAuthenticated() && user?.role === 'buyer') {
      ratingsApi.canRate(id).then(r => setCanRate(r.data)).catch(() => {})
    }
  }, [id])

  const handleWhatsApp = async () => {
    if (!isAuthenticated()) { router.push('/auth/login'); return }
    try {
      const res = await propertiesApi.whatsapp(id)
      const url = res.data.whatsapp_url
      if (url) window.open(url, '_blank')
    } catch { toast.error('Could not open WhatsApp.') }
  }

  const handleEnquire = async () => {
    if (!isAuthenticated()) { router.push('/auth/login'); return }
    setEnquiring(true)
    try {
      await propertiesApi.enquire(id)
      toast.success('Enquiry sent! The seller will be notified.')
    } catch { toast.error('Could not send enquiry.') }
    finally { setEnquiring(false) }
  }

  const handleSubmitReview = async () => {
    if (!stars) { toast.error('Please select a star rating.'); return }
    setSubmitting(true)
    try {
      await ratingsApi.submit(property.property.seller_id, { stars, review: review || null, property_id: id })
      toast.success('Thank you for your review!')
      setShowReview(false)
      // Refresh ratings
      const r = await ratingsApi.seller(id)
      setRatings(r.data)
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Could not submit review.')
    } finally { setSubmitting(false) }
  }

  if (loading) return (
    <>
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="h-96 bg-sand rounded-2xl animate-pulse mb-6" />
        <div className="h-8 w-64 bg-sand rounded animate-pulse mb-3" />
        <div className="h-4 w-48 bg-sand rounded animate-pulse" />
      </div>
    </>
  )

  if (!property) return (
    <>
      <Navbar />
      <div className="text-center py-20">
        <p className="text-stone">Property not found.</p>
        <Link href="/search" className="btn-primary mt-4 inline-block">Browse Properties</Link>
      </div>
    </>
  )

  const p      = property.property
  const seller = p.seller
  const photos = p.photos?.length ? p.photos : []
  const isShortStay = p.listing_type === 'short_stay' || p.property_type === 'airbnb' || p.property_type === 'lodge'

  return (
    <>
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">

          {/* ── LEFT — main content ── */}
          <div className="lg:col-span-2">

            {/* Gallery */}
            <div className="rounded-2xl overflow-hidden mb-4 bg-ink aspect-[16/9] relative">
              {photos[activeImg] ? (
                <Image src={photos[activeImg]} alt={p.title} fill className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl">
                  {p.property_type === 'land' ? '🌿'
                    : p.property_type === 'airbnb' ? '🏖️'
                    : p.property_type === 'lodge' ? '🏨'
                    : p.property_type === 'house' ? '🏡'
                    : p.property_type === 'apartment' ? '🏢'
                    : p.property_type === 'rental' ? '🏠'
                    : '🏠'}
                </div>
              )}
              {/* Badges */}
              <div className="absolute top-4 left-4 flex gap-2">
                <span className={`text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-sm text-white ${p.listing_type === 'sale' ? 'bg-ink/80' : p.listing_type === 'short_stay' ? 'bg-gold/90' : 'bg-forest/90'}`}>
                  {p.listing_type === 'sale' ? 'For Sale' : p.listing_type === 'short_stay' ? 'Short Stay' : 'For Rent'}
                </span>
                {p.land_title_verified && (
                  <span className="text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-sm bg-forest/90 text-white">📜 Title Verified</span>
                )}
                {p.featured && (
                  <span className="text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-sm bg-gold text-white">★ Featured</span>
                )}
              </div>
            </div>

            {/* Thumbnails */}
            {photos.length > 1 && (
              <div className="flex gap-2 mb-6 overflow-x-auto">
                {photos.map((src: string, i: number) => (
                  <button key={i} onClick={() => setActiveImg(i)}
                    className={`w-16 h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${activeImg === i ? 'border-ink' : 'border-transparent'}`}>
                    <Image src={src} alt="" width={64} height={56} className="object-cover w-full h-full" />
                  </button>
                ))}
              </div>
            )}

            {/* Price & title */}
            <div className="mb-6">
              <div className="font-display text-4xl font-semibold text-ink mb-1">
                {formatUGX(p.price)}
                {p.listing_type === 'rent' && <span className="text-lg font-normal font-body text-stone"> /month</span>}
                {isShortStay && <span className="text-lg font-normal font-body text-stone"> /night</span>}
              </div>
              <h1 className="text-xl font-medium text-ink mb-2">{p.title}</h1>
              <div className="flex items-center gap-2 text-sm text-stone">
                <MapPin className="w-4 h-4 text-gold" />
                {p.location}{p.district ? `, ${p.district}` : ''}
              </div>
            </div>

            {/* Facts grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-px bg-sand rounded-xl overflow-hidden mb-6">
              {[
                p.bedrooms   != null && [`${p.bedrooms}`,   'Bedrooms',   <Bed  className="w-4 h-4" />],
                p.bathrooms  != null && [`${p.bathrooms}`,  'Bathrooms',  <Bath className="w-4 h-4" />],
                p.size               && [p.size,            'Size',       <Ruler className="w-4 h-4" />],
                p.max_guests != null && [`${p.max_guests}`, 'Max Guests', <Users className="w-4 h-4" />],
                p.land_title_lat     && [p.land_title_lat,  'Latitude',   '📍'],
                p.land_title_lng     && [p.land_title_lng,  'Longitude',  '📍'],
              ].filter(Boolean).map(([val, label, icon]: any) => (
                <div key={label} className="bg-white px-4 py-4 text-center">
                  <div className="text-stone mb-1 flex justify-center">{typeof icon === 'string' ? icon : icon}</div>
                  <div className="text-sm font-semibold text-ink">{val}</div>
                  <div className="text-[10px] uppercase tracking-wide text-dust mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {/* Google Maps button for land */}
            {property.has_map_location && property.google_maps_url && (
              <a href={property.google_maps_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 w-full justify-center py-3 border border-forest text-forest rounded-xl text-sm font-semibold mb-6 hover:bg-forest hover:text-white transition-all">
                <Map className="w-4 h-4" />
                View Exact Location on Google Maps
              </a>
            )}

            {/* Amenities — short stay / lodge */}
            {p.amenities?.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-bold uppercase tracking-wide text-dust mb-3">Amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {p.amenities.map((a: string) => (
                    <span key={a} className="flex items-center gap-1.5 px-3 py-1.5 bg-cream border border-sand rounded-full text-sm text-ink">
                      <span>{AMENITY_ICONS[a] ?? '✓'}</span> {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="mb-8">
              <h3 className="text-sm font-bold uppercase tracking-wide text-dust mb-3">About this property</h3>
              <p className="text-sm text-stone leading-relaxed whitespace-pre-line">{p.description}</p>
            </div>

            {/* Seller info */}
            <div className="card p-5 mb-8">
              <h3 className="text-xs font-bold uppercase tracking-wide text-dust mb-4">Listed by</h3>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-ink flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-display text-xl">{(seller?.display_name ?? seller?.name)?.[0]}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-ink">{seller?.company_name ?? seller?.name}</span>
                    {seller?.blue_badge && <span className="text-blue-400 text-sm">🔵</span>}
                  </div>
                  <p className="text-xs font-semibold text-forest-2 mt-0.5">{property.trust_label}</p>
                  {property.seller_rating > 0 && (
                    <div className="flex items-center gap-1 mt-1.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className={`w-3 h-3 ${s <= Math.round(property.seller_rating) ? 'fill-gold text-gold' : 'text-sand'}`} />
                      ))}
                      <span className="text-xs text-stone ml-1">{property.seller_rating} ({property.seller_reviews} reviews)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Ratings section */}
            {ratings && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-dust">
                    Buyer Reviews ({ratings.total})
                  </h3>
                  {canRate?.can_rate && !showReview && (
                    <button onClick={() => setShowReview(true)} className="btn-outline py-1.5 px-4 text-xs">
                      Leave a Review
                    </button>
                  )}
                </div>

                {/* Star breakdown */}
                {ratings.total > 0 && (
                  <div className="flex items-center gap-6 p-4 bg-cream rounded-xl mb-4">
                    <div className="text-center">
                      <div className="font-display text-4xl font-light text-ink">{ratings.average}</div>
                      <div className="flex gap-0.5 justify-center mt-1">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} className={`w-3.5 h-3.5 ${s <= Math.round(ratings.average) ? 'fill-gold text-gold' : 'text-sand'}`} />
                        ))}
                      </div>
                      <div className="text-xs text-stone mt-1">{ratings.total} reviews</div>
                    </div>
                    <div className="flex-1 space-y-1">
                      {[5,4,3,2,1].map(s => (
                        <div key={s} className="flex items-center gap-2">
                          <span className="text-xs text-stone w-4">{s}</span>
                          <div className="flex-1 h-1.5 bg-sand rounded-full overflow-hidden">
                            <div className="h-full bg-gold rounded-full" style={{ width: `${ratings.breakdown?.[s]?.percentage ?? 0}%` }} />
                          </div>
                          <span className="text-xs text-stone w-6">{ratings.breakdown?.[s]?.count ?? 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Review form */}
                {showReview && (
                  <div className="p-4 border border-sand rounded-xl mb-4 bg-white">
                    <h4 className="text-sm font-semibold text-ink mb-3">Your Review</h4>
                    <div className="flex gap-2 mb-3">
                      {[1,2,3,4,5].map(s => (
                        <button key={s} onClick={() => setStars(s)}>
                          <Star className={`w-6 h-6 transition-all ${s <= stars ? 'fill-gold text-gold scale-110' : 'text-sand hover:text-gold'}`} />
                        </button>
                      ))}
                    </div>
                    <textarea value={review} onChange={e => setReview(e.target.value)}
                      placeholder="Share your experience with this seller... (optional)"
                      className="input h-24 resize-none mb-3" />
                    <div className="flex gap-2">
                      <button onClick={handleSubmitReview} disabled={submitting} className="btn-primary py-2 px-4 text-sm">
                        {submitting ? 'Submitting…' : 'Submit Review'}
                      </button>
                      <button onClick={() => setShowReview(false)} className="btn-outline py-2 px-4 text-sm">Cancel</button>
                    </div>
                  </div>
                )}

                {/* Review list */}
                <div className="space-y-3">
                  {ratings.ratings?.data?.map((r: any) => (
                    <div key={r.id} className="p-4 bg-white border border-sand rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-ink flex items-center justify-center">
                            <span className="text-white text-xs font-semibold">{r.buyer?.name?.[0]}</span>
                          </div>
                          <span className="text-sm font-medium text-ink">{r.buyer?.name}</span>
                        </div>
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map(s => <Star key={s} className={`w-3 h-3 ${s <= r.stars ? 'fill-gold text-gold' : 'text-sand'}`} />)}
                        </div>
                      </div>
                      {r.review && <p className="text-sm text-stone leading-relaxed">{r.review}</p>}
                      <p className="text-xs text-dust mt-2">{r.created_at_full}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT — sticky contact card ── */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 card p-5">
              <div className="font-display text-2xl font-semibold text-ink mb-0.5">
                {formatUGX(p.price)}
                {isShortStay && <span className="text-sm font-normal font-body text-stone"> /night</span>}
                {p.listing_type === 'rent' && !isShortStay && <span className="text-sm font-normal font-body text-stone"> /mo</span>}
              </div>
              <p className="text-xs text-stone mb-5">{p.title}</p>

              {/* Trust signals */}
              <div className="space-y-2 mb-5 pb-5 border-b border-sand">
                <div className="flex items-center gap-2 text-xs text-forest-2">
                  <Shield className="w-3.5 h-3.5" />
                  {property.trust_label}
                </div>
                {p.land_title_verified && (
                  <div className="flex items-center gap-2 text-xs text-forest-2">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Land Title Verified by Admin
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="space-y-3">
                <button onClick={handleWhatsApp}
                  className="btn-wa w-full justify-center">
                  <MessageCircle className="w-4 h-4" />
                  Chat on WhatsApp
                </button>
                <button onClick={handleEnquire} disabled={enquiring}
                  className="btn-primary w-full flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" />
                  {enquiring ? 'Sending…' : 'Send Enquiry'}
                </button>
                {seller?.phone && (
                  <a href={`tel:${seller.phone}`} className="btn-outline w-full flex items-center justify-center gap-2">
                    <Phone className="w-4 h-4" />
                    Call Seller
                  </a>
                )}

                {/* Booking for short stay */}
                {isShortStay && p.seller?.booking_enabled && (
                  <Link href={`/properties/${id}/book`}
                    className="w-full text-center py-3 bg-gold text-white text-sm font-semibold rounded-lg hover:bg-gold-2 transition-all flex items-center justify-center gap-2 shadow-gold">
                    📅 Book & Pay Online
                  </Link>
                )}
              </div>

              <p className="text-[10px] text-dust text-center mt-4 leading-relaxed">
                All contacts are tracked and attributed to Find My Home. The seller has been verified.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
