import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string; name: string; email: string; phone: string;
  role: 'buyer' | 'seller' | 'company' | 'admin';
  kyc_status: string; blue_badge: boolean; average_rating: number;
  total_reviews: number; company_name?: string; booking_enabled?: boolean;
  free_featured_slots?: number; seller_categories?: string[];
}

interface AuthState {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
  isAuthenticated: () => boolean
  isAdmin: () => boolean
  isSeller: () => boolean
  isVerified: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user:  null,
      token: null,

      setAuth: (user, token) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('fmh_token', token)
          localStorage.setItem('fmh_user', JSON.stringify(user))
        }
        set({ user, token })
      },

      clearAuth: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('fmh_token')
          localStorage.removeItem('fmh_user')
        }
        set({ user: null, token: null })
      },

      isAuthenticated: () => !!get().token && !!get().user,
      isAdmin:         () => get().user?.role === 'admin',
      isSeller:        () => ['seller', 'company'].includes(get().user?.role ?? ''),
      isVerified:      () => get().user?.kyc_status === 'verified',
    }),
    { name: 'fmh-auth' }
  )
)
