'use client'
import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Bed, Bath, Ruler, Star, Heart } from 'lucide-react'
import { formatUGX, cn } from '@/lib/utils'
import { useState } from 'react'

interface Property {
  id: string; title: string; location: string; district?: string;
  price: number; property_type: string; listing_type: string;
  bedrooms?: number; bathrooms?: number; size?: string;
  photos?: string[]; status: string; featured?: boolean;
  trust_label?: string; has_land_title?: boolean; land_title_verified?: boolean;
  has_map_location?: boolean; google_maps_url?: string;
  seller?: {
    id: string; display_name: string; blue_badge: boolean;
    average_rating: number; total_reviews: number; role: string;
  };
}

interface PropertyCardProps {
  property: Property
  className?: string
}

const TYPE_GRADIENTS: Record<string, string> = {
  house:      'from-slate-800 to-slate-600',
  apartment:  'from-blue-900 to-blue-700',
  land:       'from-green-900 to-green-700',
  commercial: 'from-purple-900 to-purple-700',
  rental:     'from-orange-900 to-orange-700',
  airbnb:     'from-pink-900 to-pink-700',
  lodge:      'from-amber-900 to-amber-700',
}

const TYPE_IMAGE: Record<string, string> = {
  house:      '/categories/house.svg',
  apartment:  '/categories/apartments.svg',
  land:       '/categories/land.svg',
  commercial: '/categories/commercial.svg',
  rental:     '/categories/rental.svg',
  airbnb:     '/categories/airbnb.svg',
  lodge:      '/categories/lodge.svg',
}

export function PropertyCard({ property, className }: PropertyCardProps) {
  const [saved, setSaved] = useState(false)
  const gradient = TYPE_GRADIENTS[property.property_type] ?? 'from-gray-800 to-gray-600'
  const typeImage = TYPE_IMAGE[property.property_type] ?? '/categories/house.svg'

  return (
    <div className={cn('card group cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:shadow-modal', className)}>
      <Link href={`/properties/${property.id}`}>
        {/* Image */}
        <div className={cn('h-52 bg-gradient-to-br relative flex items-center justify-center', gradient)}>
          {property.photos?.[0] ? (
            <Image src={property.photos[0]} alt={property.title} fill className="object-cover" />
          ) : (
            <div className="w-20 h-20 drop-shadow-lg">
              <Image src={typeImage} alt={property.property_type} width={80} height={80} className="object-contain" />
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-3 left-3 flex gap-1.5">
            <span className={cn('text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-sm text-white',
              property.listing_type === 'sale'       ? 'bg-ink/80' :
              property.listing_type === 'short_stay' ? 'bg-amber-700/90' :
              'bg-forest/90')}>
              {property.listing_type === 'sale'       ? 'For Sale' :
               property.listing_type === 'short_stay' ? 'Short Stay' :
               'For Rent'}
            </span>
            {property.featured && (
              <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-sm bg-gold text-white">
                ★ Featured
              </span>
            )}
            {property.land_title_verified && (
              <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-sm bg-forest/90 text-white">
                📜 Titled
              </span>
            )}
          </div>

          {/* Save button */}
          <button
            onClick={e => { e.preventDefault(); setSaved(v => !v) }}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors">
            <Heart className={cn('w-4 h-4', saved ? 'fill-red-500 text-red-500' : 'text-stone')} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 pb-0">
          <div className="font-display text-xl font-semibold text-ink mb-1">
            {formatUGX(property.price)}
            {property.listing_type === 'rent' && <span className="font-body text-xs font-normal text-dust"> /mo</span>}
          </div>
          <h3 className="text-sm font-medium text-ink mb-1.5 leading-snug line-clamp-1">{property.title}</h3>
          <div className="flex items-center gap-1.5 text-xs text-stone">
            <div className="w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0" />
            {property.location}
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-4 px-4 py-3 mt-3 border-t border-sand">
          {property.bedrooms  && <span className="flex items-center gap-1 text-xs text-stone"><Bed  className="w-3.5 h-3.5" />{property.bedrooms}</span>}
          {property.bathrooms && <span className="flex items-center gap-1 text-xs text-stone"><Bath className="w-3.5 h-3.5" />{property.bathrooms}</span>}
          {property.size      && <span className="flex items-center gap-1 text-xs text-stone"><Ruler className="w-3.5 h-3.5" />{property.size}</span>}
        </div>
      </Link>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-cream">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-ink flex items-center justify-center">
            <span className="text-white text-[10px] font-semibold">{property.seller?.display_name?.[0]}</span>
          </div>
          <div>
            <p className="text-xs font-medium text-ink leading-none">
              {property.seller?.display_name}
              {property.seller?.blue_badge && <span className="ml-1 text-blue-400">🔵</span>}
            </p>
            <p className="text-[10px] text-forest-2 font-semibold mt-0.5">
              {property.trust_label ?? '✓ Verified'}
            </p>
          </div>
        </div>
        {(property.seller?.total_reviews ?? 0) > 0 && (
          <div className="flex items-center gap-1 text-xs text-stone">
            <Star className="w-3 h-3 fill-gold text-gold" />
            {property.seller?.average_rating}
          </div>
        )}
      </div>
    </div>
  )
}
