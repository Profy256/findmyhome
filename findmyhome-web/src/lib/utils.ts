import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatUGX(amount: number): string {
  return 'UGX ' + new Intl.NumberFormat('en-UG').format(amount)
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-UG', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

export function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)    return 'Just now'
  if (mins < 60)   return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)    return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)    return `${days}d ago`
  return formatDate(date)
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const clean = phone.replace(/\D/g, '')
  const ugPhone = clean.startsWith('256') ? clean : `256${clean.startsWith('0') ? clean.slice(1) : clean}`
  return `https://wa.me/${ugPhone}?text=${encodeURIComponent(message)}`
}

export function buildWhatsAppMessage(propertyTitle: string, buyerName: string): string {
  return `Hello! I found your listing on Find My Home.\nProperty: ${propertyTitle}\nI am interested and would like more details.\nMy name is ${buyerName}.`
}

export const PROPERTY_TYPES = ['house', 'airbnb', 'lodge', 'rental', 'apartment', 'land']
export const DISTRICTS = ['Kampala', 'Wakiso', 'Entebbe', 'Mukono', 'Jinja', 'Mbarara', 'Gulu', 'Masaka']
export const AREAS = [
  'Kampala', 'Wakiso', 'Entebbe', 'Mukono', 'Ntinda', 'Kira',
  'Muyenga', 'Kololo', 'Bukoto', 'Nansana', 'Kireka', 'Najjera',
  'Bugolobi', 'Naguru', 'Jinja', 'Mbarara'
]

// Used by seller onboarding + seller settings pages.
export const SELLER_CATEGORIES = [
  { key: 'land',       label: 'Land',               strictness: 'Strict',   emoji: '🌿', threshold: 95, image: '/categories/land.svg' },
  { key: 'apartment',  label: 'Apartments',        strictness: 'Moderate', emoji: '🏢', threshold: 90, image: '/categories/apartments.svg' },
  { key: 'house',      label: 'Houses',            strictness: 'Moderate', emoji: '🏡', threshold: 90, image: '/categories/house.svg' },
  { key: 'rental',     label: 'Rentals',           strictness: 'Light',    emoji: '🏠', threshold: 80, image: '/categories/rental.svg' },
  { key: 'airbnb',     label: 'Airbnb',            strictness: 'Light',    emoji: '🏖️', threshold: 80, image: '/categories/airbnb.svg' },
  { key: 'lodge',      label: 'Lodges',            strictness: 'Light',    emoji: '🏨', threshold: 80, image: '/categories/lodge.svg' },
]
