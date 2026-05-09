import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { PropertyCard } from '@/components/properties/PropertyCard'
import { SearchBar } from '@/components/properties/SearchBar'
import { Shield, Star, MessageCircle, BadgeCheck, Map, TrendingUp } from 'lucide-react'

async function getFeaturedProperties() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/properties?featured=true&page=1`,
      { next: { revalidate: 300 } }
    )
    const data = await res.json()
    return data.data ?? []
  } catch { return [] }
}

async function getRecentProperties() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/properties?page=1`,
      { next: { revalidate: 120 } }
    )
    const data = await res.json()
    return data.data?.slice(0, 6) ?? []
  } catch { return [] }
}

export default async function HomePage() {
  const [featured, recent] = await Promise.all([getFeaturedProperties(), getRecentProperties()])

  return (
    <>
      <Navbar />
      <main>

        {/* ── HERO ── */}
        <section className="min-h-[88vh] bg-ink relative overflow-hidden flex items-center">
          <div className="absolute inset-0 bg-radial-gradient from-gold/10 via-transparent to-transparent" />
          <div className="absolute inset-0 opacity-[0.035]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.6) 1px,transparent 1px)', backgroundSize: '72px 72px' }} />

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-20">
            <div className="grid lg:grid-cols-2 gap-16 items-center">

              {/* Left — headline */}
              <div>
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-8 h-px bg-gold-2" />
                  <span className="text-[10px] font-bold uppercase tracking-[2px] text-gold-2">
                    Uganda's Premier Property Marketplace
                  </span>
                </div>
                <h1 className="font-display text-6xl lg:text-7xl font-light text-white leading-[1.05] tracking-tight mb-6">
                  Find Your<br />
                  <em className="italic text-gold-2">Perfect Home</em>
                </h1>
                <p className="text-base text-white/55 leading-relaxed max-w-md mb-10 font-light">
                  Search verified properties from trusted sellers across Uganda.
                  Every listing is KYC-verified — no scams, no guesswork.
                </p>
                <div className="flex gap-4">
                  <Link href="/search" className="btn-gold">Browse Properties</Link>
                  <Link href="/auth/register?role=seller" className="px-6 py-3 border border-white/20 text-white/80 text-sm font-medium rounded-lg hover:border-white/50 hover:text-white transition-all">
                    List Your Property →
                  </Link>
                </div>

                {/* Stats */}
                <div className="flex gap-8 mt-12 pt-10 border-t border-white/10">
                  {[['2,400+','Properties'],['1,200+','Verified Sellers'],['850','Sales'],['4.8★','Rating']].map(([n,l]) => (
                    <div key={l}>
                      <div className="font-display text-2xl font-light text-white">{n}</div>
                      <div className="text-[10px] text-white/38 uppercase tracking-[1.5px] mt-1">{l}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right — search card */}
              <div>
                <SearchBar />
              </div>
            </div>
          </div>
        </section>

        {/* ── FEATURED ── */}
        {featured.length > 0 && (
          <section className="py-20 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-end justify-between mb-14">
                <div>
                  <div className="section-label">Curated Selection</div>
                  <h2 className="section-title">Featured Properties</h2>
                </div>
                <Link href="/search" className="text-[11px] font-bold uppercase tracking-[1.5px] text-ink border-b border-ink pb-0.5 hover:opacity-50 transition-opacity">
                  View All
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
                {featured.map((p: any) => <PropertyCard key={p.id} property={p} />)}
              </div>
            </div>
          </section>
        )}

        {/* ── CATEGORIES ── */}
        <section className="py-20 bg-cream">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="section-label">Browse By Type</div>
            <h2 className="section-title mb-12">What Are You Looking For?</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { type:'house',      label:'Houses',     count:'820+', emoji:'🏡', bg:'from-slate-800 to-slate-600' },
                { type:'airbnb',     label:'Airbnb',     count:'180+', emoji:'🏖️', bg:'from-violet-900 to-violet-700' },
                { type:'lodge',      label:'Lodges',     count:'140+', emoji:'🏨', bg:'from-emerald-900 to-emerald-700' },
                { type:'rental',     label:'Rentals',    count:'540+', emoji:'🏠', bg:'from-orange-900 to-orange-700' },
                { type:'apartment',  label:'Apartments', count:'640+', emoji:'🏢', bg:'from-blue-900 to-blue-700' },
                { type:'land',       label:'Land',       count:'310+', emoji:'🌿', bg:'from-green-900 to-green-700' },
              ].map(cat => (
                <Link key={cat.type} href={`/search?type=${cat.type}`}
                  className={`relative h-36 rounded-2xl overflow-hidden bg-gradient-to-br ${cat.bg} flex flex-col justify-end p-5 group`}>
                  <div className="absolute top-4 left-5 text-3xl group-hover:scale-110 transition-transform">{cat.emoji}</div>
                  <div className="text-base font-semibold text-white">{cat.label}</div>
                  <div className="text-xs font-light text-white/55">{cat.count} listings</div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── RECENT LISTINGS ── */}
        {recent.length > 0 && (
          <section className="py-20 bg-paper">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-end justify-between mb-14">
                <div>
                  <div className="section-label">Just Listed</div>
                  <h2 className="section-title">Recent Properties</h2>
                </div>
                <Link href="/search?sort=newest" className="text-[11px] font-bold uppercase tracking-[1.5px] text-ink border-b border-ink pb-0.5 hover:opacity-50 transition-opacity">
                  See All
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
                {recent.map((p: any) => <PropertyCard key={p.id} property={p} />)}
              </div>
            </div>
          </section>
        )}

        {/* ── TRUST ── */}
        <section className="bg-forest py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              {[
                { icon: Shield,        label: 'KYC Verified',     sub: 'Every seller ID-checked' },
                { icon: BadgeCheck,    label: 'Blue Badge',       sub: 'Premium verified agents' },
                { icon: MessageCircle, label: 'WhatsApp Leads',   sub: 'Platform tracked' },
                { icon: Star,          label: 'Genuine Reviews',  sub: 'Real buyer ratings' },
                { icon: TrendingUp,    label: 'AI Fraud Check',   sub: 'Duplicate detection' },
              ].map(({ icon: Icon, label, sub }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{label}</div>
                    <div className="text-xs font-light text-white/50 mt-0.5">{sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS — moved down as per design decision ── */}
        <section className="py-20 bg-ink">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="w-10 h-px bg-gold" />
                <span className="text-[10px] font-bold uppercase tracking-[2px] text-gold">The Process</span>
                <div className="w-10 h-px bg-gold" />
              </div>
              <h2 className="font-display text-4xl font-light text-white">How Find My Home Works</h2>
            </div>
            <div className="grid md:grid-cols-4 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/5">
              {[
                { n:'01', emoji:'🔍', title:'Search & Filter',    desc:'Filter by location, price, type, and size. Use our smart search to find exactly what you need.' },
                { n:'02', emoji:'✅', title:'Verified Sellers',   desc:'Every seller is KYC-verified. Blue badge companies have passed additional business verification.' },
                { n:'03', emoji:'💬', title:'Chat on WhatsApp',   desc:'Contact sellers instantly. Every lead is tracked and attributed to Find My Home automatically.' },
                { n:'04', emoji:'🤝', title:'Close Your Deal',    desc:'Confirm the transaction through the platform. Commission is tracked and property marked complete.' },
              ].map(h => (
                <div key={h.n} className="p-12 bg-white/[0.02] hover:bg-white/[0.05] transition-colors">
                  <div className="font-display text-5xl font-light text-gold/25 leading-none mb-5">{h.n}</div>
                  <div className="text-2xl mb-4">{h.emoji}</div>
                  <h3 className="text-sm font-semibold text-white mb-2">{h.title}</h3>
                  <p className="text-xs font-light text-white/42 leading-relaxed">{h.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── SELLER CTA ── */}
        <section className="py-20 bg-paper">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <div className="section-label">For Property Owners</div>
            <h2 className="section-title mb-4">Own Property in Uganda?</h2>
            <p className="text-base text-stone font-light leading-relaxed mb-8">
              List it on Find My Home and connect with thousands of verified buyers.
              Registered companies get a free Blue Badge, reduced commission, and priority ranking.
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/auth/register?role=seller"   className="btn-primary">List as Individual</Link>
              <Link href="/auth/register?role=company"  className="btn-gold">Register as Company</Link>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="bg-ink-2 text-white/42 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-12">
              <div className="col-span-2 md:col-span-1">
                <div className="font-display text-xl font-semibold text-white mb-4">
                  🏠 Find My <span className="text-gold-2">Home</span>
                </div>
                <p className="text-sm font-light leading-relaxed max-w-xs">
                  Uganda's most trusted real estate marketplace. Verified sellers, genuine listings, zero tolerance for fraud.
                </p>
              </div>
              {[
                { title:'Properties', links:[['Houses for Sale','/search?type=house&listing=sale'],['Apartments for Rent','/search?type=apartment&listing=rent'],['Land Listings','/search?type=land'],['Commercial','/search?type=commercial']] },
                { title:'For Sellers', links:[['List a Property','/auth/register?role=seller'],['Verify Your Account','/dashboard/kyc'],['Blue Badge','/dashboard/kyc'],['Seller Dashboard','/dashboard']] },
                { title:'Company',   links:[['About Us','#'],['How It Works','#'],['Privacy Policy','#']] },
              ].map(col => (
                <div key={col.title}>
                  <h4 className="text-[10px] font-bold uppercase tracking-[2px] text-white/60 mb-4">{col.title}</h4>
                  {col.links.map(([label, href]) => (
                    <Link key={label} href={href} className="block text-sm font-light mb-2.5 hover:text-white transition-colors">{label}</Link>
                  ))}
                </div>
              ))}
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-[2px] text-white/60 mb-4">Contact Us</h4>
                <a href="mailto:findmyhomeuganda@gmail.com" className="block text-sm font-light mb-2.5 hover:text-white transition-colors">findmyhomeuganda@gmail.com</a>
                <a href="tel:+256740686937" className="block text-sm font-light mb-2.5 hover:text-white transition-colors">+256 740 686 937</a>
              </div>
            </div>
            <div className="pt-6 border-t border-white/8 flex flex-col md:flex-row justify-between items-center gap-2 text-xs font-light">
              <span>© 2026 Find My Home UG. All rights reserved.</span>
              <span>Made for Uganda 🇺🇬</span>
            </div>
          </div>
        </footer>

      </main>
    </>
  )
}
