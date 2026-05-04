'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { authApi } from '@/lib/api'
import { Bell, Menu, X, Home } from 'lucide-react'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

export function Navbar() {
  const { user, isAuthenticated, clearAuth } = useAuthStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const router   = useRouter()

  // Defer auth UI until after client hydration to prevent SSR mismatch
  useEffect(() => { setMounted(true) }, [])

  const handleLogout = async () => {
    try { await authApi.logout() } catch {}
    clearAuth()
    router.push('/')
    toast.success('Logged out successfully.')
  }

  const navLinks = [
    { href: '/search', label: 'Properties' },
    { href: '/search?listing=rent', label: 'Rent' },
    { href: '/search?type=land', label: 'Land' },
  ]

  return (
    <nav className="sticky top-0 z-50 bg-paper/95 backdrop-blur-md border-b border-sand">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-ink rounded-md flex items-center justify-center">
              <Home className="w-4 h-4 text-white" />
            </div>
            <span className="font-display text-xl font-semibold text-ink">
              Find My <span className="text-gold">Home</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(l => (
              <Link key={l.href} href={l.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${pathname.startsWith(l.href.split('?')[0])
                    ? 'text-ink bg-sand'
                    : 'text-stone hover:text-ink hover:bg-cream'}`}>
                {l.label}
              </Link>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            {/* Render nothing auth-specific until mounted (avoids SSR hydration mismatch) */}
            {!mounted ? (
              <div className="flex items-center gap-3">
                <div className="w-16 h-8 rounded-lg bg-cream animate-pulse hidden md:block" />
                <div className="w-24 h-8 rounded-lg bg-sand animate-pulse" />
              </div>
            ) : isAuthenticated() ? (
              <>
                <Link href="/dashboard/notifications"
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-cream relative">
                  <Bell className="w-4 h-4 text-stone" />
                </Link>
                <div className="relative group">
                  <button className="w-9 h-9 bg-ink rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm font-display font-semibold">
                      {user?.name?.[0]}
                    </span>
                  </button>
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-sand rounded-xl shadow-modal opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <div className="p-3 border-b border-sand">
                      <p className="text-sm font-medium text-ink truncate">{user?.company_name ?? user?.name}</p>
                      <p className="text-xs text-stone capitalize">{user?.role}</p>
                    </div>
                    <div className="py-1">
                      <Link href="/dashboard" className="block px-4 py-2 text-sm text-stone hover:text-ink hover:bg-cream">Dashboard</Link>
                      {(user?.role === 'seller' || user?.role === 'company') && (
                        <Link href="/dashboard/listings" className="block px-4 py-2 text-sm text-stone hover:text-ink hover:bg-cream">My Listings</Link>
                      )}
                      {user?.role === 'admin' && (
                        <Link href="/admin" className="block px-4 py-2 text-sm text-stone hover:text-ink hover:bg-cream">Admin Panel</Link>
                      )}
                      <button onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-cream">
                        Sign out
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <Link href="/auth/login" className="btn-outline py-2 px-4 text-sm hidden md:block">Sign in</Link>
                <Link href="/auth/register" className="btn-primary py-2 px-4 text-sm">List property</Link>
              </>
            )}

            {/* Mobile menu toggle */}
            <button className="md:hidden p-2" onClick={() => setMobileOpen(v => !v)}>
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden py-3 border-t border-sand">
            {navLinks.map(l => (
              <Link key={l.href} href={l.href}
                className="block px-3 py-2 text-sm text-stone hover:text-ink"
                onClick={() => setMobileOpen(false)}>
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}
