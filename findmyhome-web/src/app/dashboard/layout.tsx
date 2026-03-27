'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { useEffect } from 'react'
import { Home, List, Users, FileCheck, BookOpen, DollarSign, Bell, Settings, LogOut, BarChart2, MessageSquare } from 'lucide-react'

const NAV = [
  { href: '/dashboard',              icon: BarChart2,     label: 'Overview',       roles: ['seller','company','buyer'] },
  { href: '/dashboard/listings',     icon: List,          label: 'My Listings',    roles: ['seller','company'] },
  { href: '/dashboard/listings/new', icon: Home,          label: 'Add Listing',    roles: ['seller','company'] },
  { href: '/dashboard/leads',        icon: MessageSquare, label: 'Leads',          roles: ['seller','company'] },
  { href: '/dashboard/kyc',          icon: FileCheck,     label: 'Verification',   roles: ['seller','company'] },
  { href: '/dashboard/bookings',     icon: BookOpen,      label: 'Bookings',       roles: ['seller','company','buyer'] },
  { href: '/dashboard/commissions',  icon: DollarSign,    label: 'Commissions',    roles: ['seller','company'] },
  { href: '/dashboard/notifications',icon: Bell,          label: 'Notifications',  roles: ['seller','company','buyer'] },
  { href: '/dashboard/settings',     icon: Settings,      label: 'Settings',       roles: ['seller','company','buyer'] },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, clearAuth } = useAuthStore()
  const pathname = usePathname()
  const router   = useRouter()

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/auth/login')
  }, [isAuthenticated])

  if (!user) return null

  const links = NAV.filter(n => n.roles.includes(user.role))

  const handleLogout = () => { clearAuth(); router.push('/') }

  return (
    <div className="flex min-h-screen bg-paper">
      {/* Sidebar */}
      <aside className="w-56 bg-ink flex-shrink-0 flex flex-col sticky top-0 h-screen">
        <div className="p-5 border-b border-white/10">
          <Link href="/" className="font-display text-lg font-semibold text-white">
            🏠 Find My <span className="text-gold-2">Home</span>
          </Link>
        </div>

        {/* User */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gold flex items-center justify-center flex-shrink-0">
              <span className="text-white font-display font-semibold">{user.name[0]}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.company_name ?? user.name}</p>
              <p className="text-[10px] text-white/40 capitalize flex items-center gap-1">
                {user.role}
                {user.blue_badge && <span className="text-blue-300">🔵</span>}
              </p>
            </div>
          </div>
          {/* KYC status */}
          {user.role !== 'buyer' && (
            <div className={`mt-2.5 text-[10px] font-semibold px-2 py-1 rounded-full inline-flex items-center gap-1
              ${user.kyc_status === 'verified' ? 'bg-forest/40 text-green-300' : user.kyc_status === 'pending' ? 'bg-amber-900/40 text-amber-300' : 'bg-red-900/40 text-red-300'}`}>
              {user.kyc_status === 'verified' ? '✓' : user.kyc_status === 'pending' ? '⏳' : '⚠'} {user.kyc_status}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {links.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-all
                  ${active ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors w-full">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  )
}
