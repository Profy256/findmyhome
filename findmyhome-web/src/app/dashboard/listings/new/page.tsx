'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { propertiesApi } from '@/lib/api'
import toast from 'react-hot-toast'
import axios from 'axios'
import { Upload, X, MapPin, Info } from 'lucide-react'

const PROPERTY_TYPES: Record<string, { label: string; emoji: string; listingType: string; showBedrooms: boolean; isShortStay: boolean; isLand: boolean }> = {
  land:       { label: 'Land',       emoji: '🌿', listingType: 'sale',       showBedrooms: false, isShortStay: false, isLand: true  },
  apartment:  { label: 'Apartments', emoji: '🏢', listingType: 'rent',       showBedrooms: true,  isShortStay: false, isLand: false },
  rental:     { label: 'Rentals',    emoji: '🏠', listingType: 'rent',       showBedrooms: true,  isShortStay: false, isLand: false },
  house:      { label: 'Houses',     emoji: '🏡', listingType: 'sale',       showBedrooms: true,  isShortStay: false, isLand: false },
  airbnb:     { label: 'Airbnb',     emoji: '🏖️', listingType: 'short_stay', showBedrooms: true,  isShortStay: true,  isLand: false },
  lodge:      { label: 'Lodges',     emoji: '🏨', listingType: 'short_stay', showBedrooms: true,  isShortStay: true,  isLand: false },
}

const AMENITIES = ['WiFi', 'DSTV', 'Parking', 'Security', 'Kitchen', 'Hot Water', 'Garden', 'Pool', 'Generator', 'Borehole', 'Breakfast', 'Airport Transfer']
const DISTRICTS = ['Kampala', 'Wakiso', 'Mukono', 'Entebbe', 'Jinja', 'Mbarara', 'Gulu', 'Masaka', 'Mbale', 'Fort Portal']

export default function NewListingPage() {
  const { user } = useAuthStore()
  const router   = useRouter()

  const [type,        setType]        = useState('house')
  const [photos,      setPhotos]      = useState<string[]>([])
  const [titleFile,   setTitleFile]   = useState<string | null>(null)
  const [titleId,     setTitleId]     = useState<string | null>(null)
  const [titleLat,    setTitleLat]    = useState('')
  const [titleLng,    setTitleLng]    = useState('')
  const [amenities,   setAmenities]   = useState<string[]>([])
  const [uploading,   setUploading]   = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [form,        setForm]        = useState<Record<string, any>>({})

  const photoRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const CLOUD    = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dtwtwdcw2'
  const PRESET   = process.env.NEXT_PUBLIC_CLOUDINARY_LISTINGS_PRESET || 'PHOTOS'

  const typeInfo = PROPERTY_TYPES[type]

  // Filter types by seller categories
  const allowedTypes = user?.seller_categories
    ? Object.keys(PROPERTY_TYPES).filter(t => user.seller_categories?.includes(t))
    : Object.keys(PROPERTY_TYPES)

  const uploadPhoto = async (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('upload_preset', PRESET)
    fd.append('folder', 'properties')
    const res = await axios.post(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, fd)
    return res.data.secure_url as string
  }

  const handlePhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    if (photos.length + files.length > 8) { toast.error('Maximum 8 photos.'); return }
    setUploading(true)
    try {
      const urls = await Promise.all(files.map(uploadPhoto))
      setPhotos(prev => [...prev, ...urls])
    } catch { toast.error('Photo upload failed.') }
    finally { setUploading(false); if (photoRef.current) photoRef.current.value = '' }
  }

  const handleTitleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('upload_preset', PRESET)
      fd.append('folder', 'land_titles')
      const res = await axios.post(`https://api.cloudinary.com/v1_1/${CLOUD}/raw/upload`, fd)
      setTitleFile(res.data.secure_url)
      setTitleId(res.data.public_id)
      toast.success('Land title uploaded.')
    } catch { toast.error('Title upload failed.') }
    finally { setUploading(false); if (titleRef.current) titleRef.current.value = '' }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!photos.length) { toast.error('Please upload at least one photo.'); return }
    if (typeInfo.isLand && user?.role === 'seller' && !titleFile) {
      toast.error('Land sellers must upload a land title document.')
      return
    }

    setSubmitting(true)
    try {
      const payload: any = {
        ...form,
        property_type: type,
        photos,
        amenities:     amenities.length ? amenities : undefined,
      }
      if (titleFile) {
        payload.land_title_url            = titleFile
        payload.land_title_cloudinary_id  = titleId
        if (titleLat) payload.land_title_lat = parseFloat(titleLat)
        if (titleLng) payload.land_title_lng = parseFloat(titleLng)
      }

      await propertiesApi.create(payload)
      toast.success('Listing created successfully!')
      router.push('/dashboard/listings')
    } catch (err: any) {
      const msg = err.response?.data?.message ?? 'Failed to create listing.'
      const errs = err.response?.data?.errors ?? {}
      const first = Object.values(errs)[0] as string[]
      toast.error(first?.[0] ?? msg)
    } finally { setSubmitting(false) }
  }

  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-light text-ink mb-1">Add New Listing</h1>
        <p className="text-sm text-stone">Fill in the details below. All fields marked * are required.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Property type */}
        <div className="card p-5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-dust mb-4">Property Type *</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {allowedTypes.map(t => {
              const ti = PROPERTY_TYPES[t]
              return (
                <button type="button" key={t} onClick={() => setType(t)}
                  className={`p-3 rounded-xl border-2 text-left transition-all
                    ${type === t ? 'border-ink bg-cream' : 'border-sand bg-white hover:border-stone'}`}>
                  <div className="text-2xl mb-1">{ti.emoji}</div>
                  <div className="text-xs font-semibold text-ink">{ti.label}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Basic details */}
        <div className="card p-5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-dust mb-4">Property Details</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-dust block mb-1.5">Title *</label>
              <input required onChange={e => set('title', e.target.value)} placeholder={`e.g. ${typeInfo.emoji} 3 Bedroom ${typeInfo.label} in Kira`} className="input" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-dust block mb-1.5">Description *</label>
              <textarea required onChange={e => set('description', e.target.value)} rows={4} placeholder="Describe the property — features, condition, access road, nearby landmarks..." className="input resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-dust block mb-1.5">
                  Price (UGX) * {typeInfo.isShortStay && <span className="text-dust font-normal">(per night)</span>}
                </label>
                <input required type="number" min="1" onChange={e => set('price', parseInt(e.target.value))} placeholder="e.g. 180000000" className="input" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-dust block mb-1.5">Size</label>
                <input onChange={e => set('size', e.target.value)} placeholder={typeInfo.isLand ? 'e.g. 50 decimals' : 'e.g. 180 sqm'} className="input" />
              </div>
            </div>
            {typeInfo.showBedrooms && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-dust block mb-1.5">Bedrooms</label>
                  <input type="number" min="0" onChange={e => set('bedrooms', parseInt(e.target.value))} placeholder="3" className="input" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-dust block mb-1.5">Bathrooms</label>
                  <input type="number" min="0" onChange={e => set('bathrooms', parseInt(e.target.value))} placeholder="2" className="input" />
                </div>
                {typeInfo.isShortStay && (
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-dust block mb-1.5">Max Guests</label>
                    <input type="number" min="1" onChange={e => set('max_guests', parseInt(e.target.value))} placeholder="4" className="input" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Location */}
        <div className="card p-5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-dust mb-4">Location</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-dust block mb-1.5">Address / Area *</label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-dust absolute left-3 top-1/2 -translate-y-1/2" />
                <input required onChange={e => set('location', e.target.value)} placeholder="e.g. Kira Road, opposite Shell station" className="input pl-9" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-dust block mb-1.5">District</label>
              <select onChange={e => set('district', e.target.value)} className="input">
                <option value="">Select district</option>
                {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Amenities — short stay / lodge */}
        {typeInfo.isShortStay && (
          <div className="card p-5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-dust mb-4">Amenities</h2>
            <div className="flex flex-wrap gap-2">
              {AMENITIES.map(a => (
                <button type="button" key={a} onClick={() => setAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-all
                    ${amenities.includes(a) ? 'bg-ink text-white border-ink' : 'bg-white text-stone border-sand hover:border-stone'}`}>
                  {a}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Photos */}
        <div className="card p-5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-dust mb-4">Photos * (min 1, max 8)</h2>
          <div className="grid grid-cols-4 gap-3 mb-3">
            {photos.map((url, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-sand">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center">
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
            {photos.length < 8 && (
              <button type="button" onClick={() => photoRef.current?.click()} disabled={uploading}
                className="aspect-square rounded-lg border-2 border-dashed border-sand hover:border-ink flex items-center justify-center transition-colors">
                {uploading ? <div className="w-5 h-5 border-2 border-ink border-t-transparent rounded-full animate-spin" />
                           : <Upload className="w-5 h-5 text-dust" />}
              </button>
            )}
          </div>
          <input ref={photoRef} type="file" accept="image/*" multiple onChange={handlePhotos} className="hidden" />
          <p className="text-xs text-stone">Upload clear, well-lit photos. First photo is the main image.</p>
        </div>

        {/* Land title section — individual sellers listing land */}
        {typeInfo.isLand && user?.role === 'seller' && (
          <div className="card p-5 border-amber-200 bg-amber-50">
            <div className="flex items-start gap-2 mb-4">
              <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-1">Land Title — Required</h2>
                <p className="text-xs text-amber-600 leading-relaxed">
                  Individual sellers must upload a land title for every land listing. This protects buyers from fraud and proves you own the land. Companies are exempt.
                </p>
              </div>
            </div>

            <input ref={titleRef} type="file" accept="image/*,.pdf" onChange={handleTitleUpload} className="hidden" />
            <button type="button" onClick={() => titleRef.current?.click()} disabled={uploading}
              className={`w-full border-2 border-dashed rounded-xl py-5 flex flex-col items-center gap-2 transition-all mb-4
                ${titleFile ? 'border-forest bg-green-50' : 'border-amber-300 bg-white hover:border-amber-500'}`}>
              {titleFile
                ? <><CheckCircle className="w-6 h-6 text-forest-2" /><span className="text-sm text-forest-2 font-semibold">Land Title Uploaded ✓</span></>
                : <><Upload className="w-6 h-6 text-amber-400" /><span className="text-sm text-amber-600">Upload Land Title (PDF or Image)</span></>
              }
            </button>

            {/* Coordinates */}
            <div>
              <div className="flex items-start gap-2 mb-3">
                <Info className="w-3.5 h-3.5 text-stone flex-shrink-0 mt-0.5" />
                <p className="text-xs text-stone leading-relaxed">
                  <strong>Optional:</strong> The coordinates on your land title are Google Maps coordinates. Adding them lets buyers see the exact location of your plot before contacting you. It takes 10 seconds.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-dust block mb-1.5">Latitude (from title)</label>
                  <input value={titleLat} onChange={e => setTitleLat(e.target.value)} placeholder="e.g. 0.3127" className="input text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-dust block mb-1.5">Longitude (from title)</label>
                  <input value={titleLng} onChange={e => setTitleLng(e.target.value)} placeholder="e.g. 32.4951" className="input text-sm" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Company land — coordinates optional */}
        {typeInfo.isLand && user?.role === 'company' && (
          <div className="card p-5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-dust mb-2">GPS Coordinates (Optional)</h2>
            <p className="text-xs text-stone mb-4">As a registered company, you don't need to upload a land title. You can optionally add GPS coordinates from your land title to help buyers find the exact location.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-dust block mb-1.5">Latitude</label>
                <input value={titleLat} onChange={e => setTitleLat(e.target.value)} placeholder="e.g. 0.3127" className="input" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-dust block mb-1.5">Longitude</label>
                <input value={titleLng} onChange={e => setTitleLng(e.target.value)} placeholder="e.g. 32.4951" className="input" />
              </div>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3">
          <button type="submit" disabled={submitting || uploading} className="btn-gold flex-1">
            {submitting ? 'Publishing…' : 'Publish Listing'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-outline px-6">Cancel</button>
        </div>
      </form>
    </div>
  )
}

function CheckCircle({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
}
