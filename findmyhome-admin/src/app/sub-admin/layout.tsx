'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { useEffect, useState } from 'react'
import { BarChart2, Users, FileCheck, Home, DollarSign, Star, LogOut, Menu, X, BookOpen, MessageSquare, ShieldAlert } from 'lucide-react'

const SUB_ADMIN_NAV = [
  { href: '/sub-admin',             icon: BarChart2,     label: 'Dashboard'   },
  { href: '/sub-admin/users',       icon: Users,         label: 'Users'       },
  { href: '/sub-admin/kyc',         icon: FileCheck,     label: 'KYC Review'  },
  { href: '/sub-admin/properties',  icon: Home,          label: 'Properties'  },
  { href: '/sub-admin/commissions', icon: DollarSign,    label: 'Commissions' },
  { href: '/sub-admin/ratings',     icon: Star,          label: 'Reviews'     },
  { href: '/sub-admin/bookings',    icon: BookOpen,      label: 'Bookings'    },
  { href: '/sub-admin/leads',       icon: MessageSquare, label: 'Leads'       },
]

export default function SubAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, clearAuth } = useAuthStore()
  const pathname = usePathname()
  const router   = useRouter()
  const [hydrated,    setHydrated]    = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => { setHydrated(true) }, [])

  useEffect(() => {
    if (!hydrated) return
    if (!isAuthenticated() || user?.role !== 'sub_admin') router.replace('/auth/login')
  }, [user, hydrated, router, isAuthenticated])

  useEffect(() => { setSidebarOpen(false) }, [pathname])

  if (!hydrated) return null
  if (!user || user.role !== 'sub_admin') return null

  return (
    <div className="flex min-h-screen bg-paper">

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={[
        'fixed inset-y-0 left-0 z-30 w-72 bg-ink flex flex-col',
        'transition-transform duration-300 ease-in-out',
        'md:sticky md:top-0 md:h-screen md:w-56 md:flex-shrink-0 md:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}>

        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <Link href="/" className="font-display text-lg text-white font-semibold">
              🏠 Find My <span className="text-gold-2">Home</span>
            </Link>
            <div className="flex items-center gap-1.5 mt-0.5">
              <ShieldAlert className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] text-amber-400 uppercase tracking-[1.5px]">Sub-Admin</span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-white/50 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {SUB_ADMIN_NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/sub-admin' && pathname.startsWith(href))
            return (
              <Link key={href} href={href}
                className={[
                  'flex items-center gap-3 px-4 py-3 mx-2 rounded-lg text-sm transition-all',
                  active ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white hover:bg-white/5',
                ].join(' ')}>
                <Icon className="w-4 h-4 flex-shrink-0" /> {label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="text-xs text-white/30 mb-3 truncate">{user.name}</div>
          <button
            onClick={() => { clearAuth(); router.push('/') }}
            className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors w-full py-1"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden sticky top-0 z-10 bg-ink border-b border-white/10 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-white p-1 -ml-1 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1 min-w-0">
            <span className="font-display text-base font-semibold text-white">
              🏠 Find My <span className="text-gold-2">Home</span>
            </span>
            <span className="text-[10px] text-amber-400 uppercase tracking-[1.5px] ml-2">Sub-Admin</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 py-5 md:px-6 md:py-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
