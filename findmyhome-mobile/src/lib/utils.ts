export const C = {
  ink:    '#1c1c1a',
  ink2:   '#2d2d2a',
  stone:  '#6b6b65',
  dust:   '#a8a8a0',
  sand:   '#e8e4dc',
  cream:  '#f5f2ec',
  paper:  '#faf8f4',
  white:  '#ffffff',
  gold:   '#b8965a',
  gold2:  '#cda96e',
  forest: '#2d4a3e',
  forest2:'#3a6b55',
  wa:     '#25D366',
  red:    '#e53e3e',
  blue:   '#3182ce',
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
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)  return `${days}d ago`
  return formatDate(date)
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const clean   = phone.replace(/\D/g, '')
  const ugPhone = clean.startsWith('256') ? clean : `256${clean.startsWith('0') ? clean.slice(1) : clean}`
  return `https://wa.me/${ugPhone}?text=${encodeURIComponent(message)}`
}

export function buildWhatsAppMessage(propertyTitle: string, buyerName: string): string {
  return `Hi, my name is ${buyerName}. I am interested in your listing on Find My Home: "${propertyTitle}". Could you please provide more details?`
}

export const AREAS = [
  'Kampala', 'Wakiso', 'Entebbe', 'Mukono', 'Ntinda', 'Kira',
  'Muyenga', 'Kololo', 'Bukoto', 'Nansana', 'Kireka', 'Najjera',
  'Bugolobi', 'Naguru', 'Jinja', 'Mbarara',
]

export const PROPERTY_TYPES = [
  { key: 'house',      label: 'Houses',     emoji: '🏡' },
  { key: 'airbnb',     label: 'Airbnb',     emoji: '🏖️' },
  { key: 'lodge',      label: 'Lodges',     emoji: '🏨' },
  { key: 'rental',     label: 'Rentals',    emoji: '🏠' },
  { key: 'apartment',  label: 'Apartments', emoji: '🏢' },
  { key: 'land',       label: 'Land',       emoji: '🌿' },
]

export const SELLER_CATEGORIES = [
  { key: 'land',       label: 'Land',               strictness: 'Strict',   emoji: '🌿', threshold: 95 },
  { key: 'apartment',  label: 'Apartments',         strictness: 'Moderate', emoji: '🏢', threshold: 90 },
  { key: 'house',      label: 'Houses',             strictness: 'Moderate', emoji: '🏡', threshold: 90 },
  { key: 'rental',     label: 'Rentals',            strictness: 'Light',    emoji: '🏠', threshold: 80 },
  { key: 'airbnb',     label: 'Airbnb',             strictness: 'Light',    emoji: '🏖️', threshold: 80 },
  { key: 'lodge',      label: 'Lodge / Guest House',strictness: 'Light',    emoji: '🏨', threshold: 80 },
]
