import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'

interface User {
  id: string; name: string; email: string; phone: string
  role: 'buyer' | 'seller' | 'company' | 'admin'
  kyc_status: string; blue_badge: boolean
  average_rating: number; total_reviews: number
  company_name?: string; seller_categories?: string[]
  booking_enabled?: boolean; free_featured_slots?: number
}

interface AuthState {
  user: User | null
  token: string | null
  hydrated: boolean
  setAuth: (user: User, token: string) => Promise<void>
  clearAuth: () => Promise<void>
  hydrate: () => Promise<void>
  isAuthenticated: () => boolean
  isAdmin: () => boolean
  isSeller: () => boolean
  isBuyer: () => boolean
  isVerified: () => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  hydrated: false,

  setAuth: async (user, token) => {
    await SecureStore.setItemAsync('fmh_token', token)
    await SecureStore.setItemAsync('fmh_user', JSON.stringify(user))
    set({ user, token })
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync('fmh_token')
    await SecureStore.deleteItemAsync('fmh_user')
    set({ user: null, token: null })
  },

  hydrate: async () => {
    try {
      const token = await SecureStore.getItemAsync('fmh_token')
      const userStr = await SecureStore.getItemAsync('fmh_user')
      if (token && userStr) {
        set({ token, user: JSON.parse(userStr) })
      }
    } catch {}
    set({ hydrated: true })
  },

  isAuthenticated: () => !!get().token && !!get().user,
  isAdmin:         () => get().user?.role === 'admin',
  isSeller:        () => ['seller', 'company'].includes(get().user?.role ?? ''),
  isBuyer:         () => get().user?.role === 'buyer',
  isVerified:      () => get().user?.kyc_status === 'verified',
}))
