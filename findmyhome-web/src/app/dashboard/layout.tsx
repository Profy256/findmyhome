'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { authApi } from '@/lib/api'
import { useEffect, useState } from 'react'
import { Home, List, FileCheck, BookOpen, DollarSign, Bell, Settings, LogOut, BarChart2, MessageSquare, Menu, X } from 'lucide-react'

const NAV = [
  { href: '/dashboard',               icon: BarChart2,     label: 'Overview',       roles: ['seller','company','buyer'] },
  { href: '/dashboard/listings',      icon: List,          label: 'My Listings',    roles: ['seller','company'] },
  { href: '/dashboard/listings/new',  icon: Home,          label: 'Add Listing',    roles: ['seller','company'] },
  { href: '/dashboard/leads',         icon: MessageSquare, label: 'Leads',          roles: ['seller','company'] },
  { href: '/dashboard/kyc',           icon: FileCheck,     label: 'Verification',   roles: ['seller','company'] },
  { href: '/dashboard/bookings',      icon: BookOpen,      label: 'Bookings',       roles: ['seller','company','buyer'] },
  { href: '/dashboard/commissions',   icon: DollarSign,    label: 'Commissions',    roles: ['seller','company'] },
  { href: '/dashboard/notifications', icon: Bell,          label: 'Notifications',  roles: ['seller','company','buyer'] },
  { href: '/dashboard/settings',      icon: Settings,      label: 'Settings',       roles: ['seller','company','buyer'] },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, token, isAuthenticated, clearAuth, setAuth } = useAuthStore()
  const pathname = usePathname()
  const router   = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/auth/login'); return }
    // Refresh user data on every dashboard load so KYC status, role, etc. are never stale
    authApi.me()
      .then(res => { if (res.data && token) setAuth(res.data, token) })
      .catch(() => {})
  }, [])

  // Auto-close sidebar on navigation
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  if (!user) return null

  const links = NAV.filter(n => n.roles.includes(user.role))
  const handleLogout = () => { clearAuth(); router.push('/') }

  const kycColor = user.kyc_status === 'verified'
    ? 'bg-forest/40 text-green-300'
    : user.kyc_status === 'pending'
      ? 'bg-amber-900/40 text-amber-300'
      : 'bg-red-900/40 text-red-300'

  const kycIcon = user.kyc_status === 'verified' ? '✓' : user.kyc_status === 'pending' ? '⏳' : '⚠'

  return (
    <div className="flex min-h-screen bg-paper">

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed drawer on mobile, sticky on desktop */}
      <aside className={[
        'fixed inset-y-0 left-0 z-30 w-72 bg-ink flex flex-col',
        'transition-transform duration-300 ease-in-out',
        'md:sticky md:top-0 md:h-screen md:w-56 md:flex-shrink-0 md:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}>

        {/* Logo row */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <Link href="/" className="font-display text-lg font-semibold text-white">
            🏠 Find My <span className="text-gold-2">Home</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-white/50 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User card */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gold flex items-center justify-center flex-shrink-0">
              <span className="text-white font-display font-semibold text-base">{user.name[0]}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.company_name ?? user.name}</p>
              <p className="text-[10px] text-white/40 capitalize flex items-center gap-1">
                {user.role}
                {user.blue_badge && <span className="text-blue-300">🔵</span>}
              </p>
            </div>
          </div>
          {user.role !== 'buyer' && (
            <div className={`mt-2.5 text-[10px] font-semibold px-2 py-1 rounded-full inline-flex items-center gap-1 ${kycColor}`}>
              {kycIcon} {user.kyc_status}
            </div>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {links.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={[
                  'flex items-center gap-3 px-4 py-3 mx-2 rounded-lg text-sm transition-all',
                  active ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white hover:bg-white/5',
                ].join(' ')}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Sign out */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors w-full py-1"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Content column */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-10 bg-ink border-b border-white/10 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-white p-1 -ml-1 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-display text-base font-semibold text-white flex-1 truncate">
            🏠 Find My <span className="text-gold-2">Home</span>
          </span>
          <Link
            href="/dashboard/notifications"
            className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
          </Link>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 py-5 md:px-6 md:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
