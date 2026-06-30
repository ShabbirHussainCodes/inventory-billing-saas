import axios from 'axios'

const BASE_URL = 'https://billingmars-api.onrender.com/api'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Response interceptor — access token expire (15 min) ho jaaye toh
// silently refresh karke original request retry karo. User ko pata
// hi nahi chalega. Sirf jab refresh token bhi expired/invalid ho
// (7 din baad, ya logout ke baad blacklist), tab login pe bhejo.
let isRefreshing = false
let pendingQueue = []

const processQueue = (error, token = null) => {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token)
  })
  pendingQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // 401 hi handle karo, aur sirf ek baar retry karo (infinite loop se bachao)
    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = localStorage.getItem('refresh_token')

      // Refresh token hi nahi hai — login pe bhejo
      if (!refreshToken) {
        localStorage.clear()
        window.location.href = '/'
        return Promise.reject(error)
      }

      if (isRefreshing) {
        // Ek refresh already chal raha hai — naya request queue mein daal do
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const res = await axios.post(`${BASE_URL}/auth/token/refresh/`, {
          refresh: refreshToken,
        })
        const newAccessToken = res.data.access
        localStorage.setItem('access_token', newAccessToken)

        // ROTATE_REFRESH_TOKENS: True hai backend mein — naya refresh token
        // bhi aata hai response mein, usko bhi save karna zaroori hai,
        // warna purana token blacklist ho chuka hoga aur agla refresh fail hoga
        if (res.data.refresh) {
          localStorage.setItem('refresh_token', res.data.refresh)
        }

        processQueue(null, newAccessToken)
        isRefreshing = false

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        return api(originalRequest)
      } catch (refreshError) {
        // Refresh token bhi expired/invalid — ab login pe bhejna padega
        processQueue(refreshError, null)
        isRefreshing = false
        localStorage.clear()
        window.location.href = '/'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export const authAPI = {
  login: (data) => api.post('/auth/login/', data),
  register: (data) => api.post('/auth/register/', data),
  logout: (data) => api.post('/auth/logout/', data),
  profile: () => api.get('/auth/profile/'),
}

export const inventoryAPI = {
  getProducts: () => api.get('/inventory/products/'),
  addProduct: (data) => api.post('/inventory/products/', data),
  getProduct: (id) => api.get(`/inventory/products/${id}/`),
  updateProduct: (id, data) => api.put(`/inventory/products/${id}/`, data),
  deleteProduct: (id) => api.delete(`/inventory/products/${id}/`),
  getLowStock: () => api.get('/inventory/low-stock/'),

  getStockMovements: ({ productId = null, movementType = null, days = null, page = 1, pageSize = 50 } = {}) => {
    const params = new URLSearchParams()
    if (productId) params.append('product_id', productId)
    if (movementType) params.append('movement_type', movementType)
    if (days) params.append('days', days)
    params.append('page', page)
    params.append('page_size', pageSize)
    return api.get(`/inventory/stock-movements/?${params.toString()}`)
  },
  addStockMovement: (data) => api.post('/inventory/stock-movement/', data),
  getCategories: () => api.get('/inventory/categories/'),
  addCategory: (data) => api.post('/inventory/categories/', data),
  updateCategory: (id, data) => api.put(`/inventory/categories/${id}/`, data),
  deleteCategory: (id) => api.delete(`/inventory/categories/${id}/`),

  getSuppliers: () => api.get('/inventory/suppliers/'),
  addSupplier: (data) => api.post('/inventory/suppliers/', data),
  updateSupplier: (id, data) => api.put(`/inventory/suppliers/${id}/`, data),
  deleteSupplier: (id) => api.delete(`/inventory/suppliers/${id}/`),
}

export const billingAPI = {
  getCustomers: () => api.get('/billing/customers/'),
  addCustomer: (data) => api.post('/billing/customers/', data),
  updateCustomer: (id, data) => api.put(`/billing/customers/${id}/`, data),
  deleteCustomer: (id) => api.delete(`/billing/customers/${id}/`),
  getInvoices: () => api.get('/billing/invoices/'),
  createInvoice: (data) => api.post('/billing/invoices/', data),
  getInvoice: (id) => api.get(`/billing/invoices/${id}/`),
  getSummary: () => api.get('/billing/summary/'),
  updateInvoiceStatus: (id, status) => api.patch(`/billing/invoices/${id}/status/`, { status }),
  getInvoiceDetail: (id) => api.get(`/billing/invoices/${id}/`),
  updateInvoice: (id, data) => api.put(`/billing/invoices/${id}/`, data),
  deleteInvoice: (id) => api.delete(`/billing/invoices/${id}/`),
}

export const tenantAPI = {
  getSettings: () => api.get('/tenant/settings/'),
  updateSettings: (data) => api.put('/tenant/settings/', data),
}

export const superAdminAPI = {
  // Overview
  getStats: () => api.get('/superadmin/stats/'),
  getDashboard: () => api.get('/superadmin/dashboard/'),

  // Businesses
  getTenants: () => api.get('/superadmin/tenants/'),
  toggleTenant: (id) => api.put(`/superadmin/tenants/${id}/toggle/`),
  grantAccess: (id) => api.put(`/superadmin/tenants/${id}/grant-access/`),
  upgradeTenant: (id) => api.put(`/superadmin/tenants/${id}/upgrade/`),

  // Users
  getUsers: () => api.get('/superadmin/users/'),
  toggleUser: (id) => api.put(`/superadmin/users/${id}/toggle/`),
  resetPassword: (id, data) => api.post(`/superadmin/users/${id}/reset-password/`, data),

  // ── Phase 2 — Founder Support Mode ──
  enterWorkspace: (tenantId, mode = 'view') =>
    api.post(`/superadmin/workspace/enter/${tenantId}/`, { mode }),
  exitWorkspace: () =>
    api.post('/superadmin/workspace/exit/'),
  switchMode: (mode) =>
    api.post('/superadmin/workspace/switch-mode/', { mode }),
  getActiveSession: () =>
    api.get('/superadmin/workspace/session/'),

  // ── Analytics ──
  getAnalytics: () => api.get('/superadmin/analytics/'),

  // ── Audit Log ──
  getAuditLogs: ({ tenantId = null, days = null, page = 1, pageSize = 50 } = {}) => {
    const params = new URLSearchParams()
    if (tenantId) params.append('tenant_id', tenantId)
    if (days) params.append('days', days)
    params.append('page', page)
    params.append('page_size', pageSize)
    return api.get(`/superadmin/audit-logs/?${params.toString()}`)
  },
}

export default api