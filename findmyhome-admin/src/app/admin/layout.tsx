'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { useEffect, useState } from 'react'
import { adminApi } from '@/lib/api'
import { BarChart2, Users, FileCheck, Home, DollarSign, Star, Settings, LogOut, AlertTriangle } from 'lucide-react'

const ADMIN_NAV = [
  { href: '/admin',              icon: BarChart2,  label: 'Dashboard'   },
  { href: '/admin/users',        icon: Users,      label: 'Users'       },
  { href: '/admin/kyc',          icon: FileCheck,  label: 'KYC Review'  },
  { href: '/admin/properties',   icon: Home,       label: 'Properties'  },
  { href: '/admin/commissions',  icon: DollarSign, label: 'Commissions' },
  { href: '/admin/ratings',      icon: Star,       label: 'Reviews'     },
  { href: '/admin/settings',     icon: Settings,   label: 'Settings'    },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, clearAuth } = useAuthStore()
  const pathname = usePathname()
  const router   = useRouter()
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated() || user?.role !== 'admin') router.replace('/auth/login')
  }, [user, hydrated, router, isAuthenticated])

  if (!hydrated) return null; // wait for client-side localStorage hydration
  if (!user || user.role !== 'admin') return null

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="w-56 bg-ink flex-shrink-0 flex flex-col sticky top-0 h-screen">
        <div className="p-5 border-b border-white/10">
          <Link href="/" className="font-display text-lg text-white font-semibold">
            🏠 Find My <span className="text-gold-2">Home</span>
          </Link>
          <div className="text-[10px] text-white/30 mt-1 uppercase tracking-[1.5px]">Admin Panel</div>
        </div>
        <nav className="flex-1 py-4">
          {ADMIN_NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/admin' && pathname.startsWith(href))
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-all
                  ${active ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
                <Icon className="w-4 h-4" /> {label}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-white/10">
          <button onClick={() => { clearAuth(); router.push('/') }}
            className="flex items-center gap-2 text-sm text-white/40 hover:text-white">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  )
}
