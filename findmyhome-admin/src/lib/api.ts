import axios, { AxiosInstance, AxiosResponse } from 'axios'

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_URL.endsWith('/v1') ? API_URL : API_URL + '/v1',
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
})

export function isNetworkError(err: any): boolean {
  // Only classify Axios errors as "network errors".
  // Otherwise, runtime errors (e.g. in setAuth/router.push) would be misclassified.
  if (!axios.isAxiosError(err)) return false

  // Axios sets `response` only when the server responded (even with 4xx/5xx).
  // When the API is unreachable (CORS, DNS, refused connection, mixed content),
  // `response` is undefined and the error is typically ERR_NETWORK.
  return !err.response && (err.code === 'ERR_NETWORK' || err.message === 'Network Error')
}

// Attach token from localStorage on every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('fmh_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 — clear token and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('fmh_token')
      localStorage.removeItem('fmh_user')
      window.location.href = '/auth/login'
    }
    return Promise.reject(err)
  }
)

export default api

// ── Typed API calls ───────────────────────────────────────────────────────────

export const authApi = {
  register: (data: RegisterData)  => api.post('/auth/register', data),
  login:    (data: LoginData)     => api.post('/auth/login', data),
  logout:   ()                    => api.post('/auth/logout'),
  me:       ()                    => api.get('/auth/me'),
}

export const propertiesApi = {
  list:    (params?: PropertyFilters) => api.get('/properties', { params }),
  get:     (id: string)               => api.get(`/properties/${id}`),
  create:  (data: FormData)           => api.post('/properties', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update:  (id: string, data: any)    => api.put(`/properties/${id}`, data),
  delete:  (id: string)               => api.delete(`/properties/${id}`),
  mine:    ()                         => api.get('/my-listings'),
  enquire: (id: string)               => api.post(`/properties/${id}/enquire`),
  whatsapp:(id: string)               => api.post(`/properties/${id}/whatsapp`),
  book:    (id: string, data: any)    => api.post(`/properties/${id}/book`, data),
}

export const kycApi = {
  status:    ()           => api.get('/kyc'),
  upload:    (data: any)  => api.post('/kyc/upload', data),
  documents: ()           => api.get('/kyc/documents'),
}

export const ratingsApi = {
  seller:   (sellerId: string)              => api.get(`/sellers/${sellerId}/reviews`),
  canRate:  (sellerId: string)              => api.get(`/sellers/${sellerId}/can-rate`),
  submit:   (sellerId: string, data: any)   => api.post(`/sellers/${sellerId}/rate`, data),
  update:   (ratingId: string, data: any)   => api.put(`/ratings/${ratingId}`, data),
}

export const leadsApi = {
  mine: (params?: any) => api.get('/my-leads', { params }),
}

export const bookingsApi = {
  mine:         ()                              => api.get('/my-bookings'),
  updateStatus: (id: string, data: any)         => api.patch(`/bookings/${id}/status`, data),
}

export const transactionsApi = {
  create:  (data: any)  => api.post('/transactions', data),
  confirm: (id: string) => api.post(`/transactions/${id}/confirm`),
  mine:    ()           => api.get('/my-transactions'),
}

export const notificationsApi = {
  list:        ()           => api.get('/notifications'),
  unread:      ()           => api.get('/notifications/unread'),
  markRead:    (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: ()           => api.post('/notifications/mark-all-read'),
}

export const adminApi = {
  dashboard:        ()                              => api.get('/admin/dashboard'),
  users:            (params?: any)                  => api.get('/admin/users', { params }),
  viewUser:         (id: string)                    => api.get(`/admin/users/${id}`),
  blockUser:        (id: string, data?: any)        => api.post(`/admin/users/${id}/block`, data),
  unblockUser:      (id: string, data?: any)        => api.post(`/admin/users/${id}/unblock`, data),
  deleteUser:       (id: string)                    => api.delete(`/admin/users/${id}`),
  changeRole:       (id: string, role: string)      => api.patch(`/admin/users/${id}/role`, { role }),
  listKyc:          (params?: any)                  => api.get('/admin/kyc', { params }),
  approveKyc:       (docId: string)                 => api.post(`/admin/kyc/${docId}/approve`),
  rejectKyc:        (docId: string, reason: string) => api.post(`/admin/kyc/${docId}/reject`, { reason }),
  listProperties:   (params?: any)                  => api.get('/admin/properties', { params }),
  freezeListing:    (id: string, reason?: string)   => api.post(`/admin/properties/${id}/freeze`, { reason }),
  unfreezeListing:  (id: string)                    => api.post(`/admin/properties/${id}/unfreeze`),
  deleteListing:    (id: string)                    => api.delete(`/admin/properties/${id}`),
  featureListing:   (id: string, days: number)      => api.post(`/admin/properties/${id}/feature`, { days }),
  verifyTitle:      (id: string)                    => api.post(`/admin/properties/${id}/verify-title`),
  listCommissions:  (params?: any)                  => api.get('/admin/commissions', { params }),
  markCommissionPaid: (id: string)                  => api.post(`/admin/commissions/${id}/paid`),
  waiveCommission:  (id: string, reason: string)    => api.post(`/admin/commissions/${id}/waive`, { reason }),
  grantBadge:       (id: string, days?: number)     => api.post(`/admin/users/${id}/grant-badge`, { days }),
  revokeBadge:      (id: string)                    => api.post(`/admin/users/${id}/revoke-badge`),
  listRatings:      (params?: any)                  => api.get('/admin/ratings', { params }),
  hideRating:       (id: string)                    => api.post(`/admin/ratings/${id}/hide`),
  deleteRating:     (id: string)                    => api.delete(`/admin/ratings/${id}`),
  listBookings:     (params?: any)                  => api.get('/admin/bookings', { params }),
  listLeads:        (params?: any)                  => api.get('/admin/leads', { params }),
  getSettings:      ()                              => api.get('/admin/settings'),
  updateSetting:    (key: string, value: any)       => api.patch(`/admin/settings/${key}`, { value }),
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RegisterData {
  name: string; email: string; phone: string; password: string; role: string; company_name?: string;
}
export interface LoginData { email: string; password: string; }
export interface PropertyFilters {
  location?: string; type?: string; listing?: string; min_price?: number;
  max_price?: number; bedrooms?: number; blue_badge_only?: boolean; page?: number;
}
