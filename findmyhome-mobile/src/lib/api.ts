import axios, { AxiosInstance } from 'axios'
import * as SecureStore from 'expo-secure-store'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

const api: AxiosInstance = axios.create({
  baseURL: API_URL.endsWith('/v1') ? API_URL : API_URL + '/v1',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  timeout: 15000,
})

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('fmh_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await SecureStore.deleteItemAsync('fmh_token')
      await SecureStore.deleteItemAsync('fmh_user')
    }
    return Promise.reject(err)
  }
)

export default api

export const authApi = {
  register:   (data: any)   => api.post('/auth/register', data),
  login:      (data: any)   => api.post('/auth/login', data),
  logout:     ()            => api.post('/auth/logout'),
  me:         ()            => api.get('/auth/me'),
  categories: ()            => api.get('/auth/categories'),
  fcmToken:   (token: string) => api.post('/auth/fcm-token', { fcm_token: token }),
}

export const propertiesApi = {
  list:     (params?: any) => api.get('/properties', { params }),
  get:      (id: string)   => api.get(`/properties/${id}`),
  mine:     ()             => api.get('/my-listings'),
  create:   (data: any)    => api.post('/properties', data),
  update:   (id: string, data: any) => api.put(`/properties/${id}`, data),
  delete:   (id: string)   => api.delete(`/properties/${id}`),
  enquire:  (id: string)   => api.post(`/properties/${id}/enquire`),
  whatsapp: (id: string)   => api.post(`/properties/${id}/whatsapp`),
  book:     (id: string, data: any) => api.post(`/properties/${id}/book`, data),
}

export const kycApi = {
  status:    ()           => api.get('/kyc'),
  upload:    (data: any)  => api.post('/kyc/upload', data),
  documents: ()           => api.get('/kyc/documents'),
}

export const ratingsApi = {
  seller:  (sellerId: string) => api.get(`/sellers/${sellerId}/reviews`),
  canRate: (sellerId: string) => api.get(`/sellers/${sellerId}/can-rate`),
  submit:  (sellerId: string, data: any) => api.post(`/sellers/${sellerId}/rate`, data),
}

export const leadsApi = {
  mine: (params?: any) => api.get('/my-leads', { params }),
}

export const bookingsApi = {
  mine:         ()                              => api.get('/my-bookings'),
  updateStatus: (id: string, data: any)         => api.patch(`/bookings/${id}/status`, data),
}

export const transactionsApi = {
  mine:    ()           => api.get('/my-transactions'),
  confirm: (id: string) => api.post(`/transactions/${id}/confirm`),
}

export const notificationsApi = {
  list:        ()           => api.get('/notifications'),
  unread:      ()           => api.get('/notifications/unread'),
  markRead:    (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: ()           => api.post('/notifications/mark-all-read'),
}
