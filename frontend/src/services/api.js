import axios from 'axios'

const BASE_URL = 'https://billingmars-api.onrender.com/api'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000, // 60s — Render free tier cold start ~50s tak le sakta hai
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Plan limit error helper — 403 response mein plan_limit: true check karo
export function isPlanLimitError(err) {
  return err?.response?.status === 403 && err?.response?.data?.plan_limit === true
}

export function getPlanLimitMessage(err) {
  return err?.response?.data?.error || 'Plan limit reached. Please upgrade.'
}

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
  // Multi-tenant staff login step 2 — jab login() ne temporary_token +
  // businesses list return ki thi (matlab user ki 2+ active businesses hain)
  selectBusiness: (data) => api.post('/auth/login/select-business/', data),
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

  getPurchaseOrders: () => api.get('/inventory/purchase-orders/'),
  addPurchaseOrder: (data) => api.post('/inventory/purchase-orders/', data),
  getPurchaseOrder: (id) => api.get(`/inventory/purchase-orders/${id}/`),
  deletePurchaseOrder: (id) => api.delete(`/inventory/purchase-orders/${id}/`),
  updatePurchaseOrderStatus: (id, status) => api.patch(`/inventory/purchase-orders/${id}/status/`, { status }),
  getFreightSummary: (year, month) => api.get(`/inventory/purchase-orders/freight-summary/?year=${year}&month=${month}`),
}

export const billingAPI = {
  getCustomers: () => api.get('/billing/customers/'),
  getEstimates: () => api.get('/billing/estimates/'),
  addEstimate: (data) => api.post('/billing/estimates/', data),
  getEstimate: (id) => api.get(`/billing/estimates/${id}/`),
  deleteEstimate: (id) => api.delete(`/billing/estimates/${id}/`),
  updateEstimateStatus: (id, status) => api.patch(`/billing/estimates/${id}/status/`, { status }),
  convertEstimateToInvoice: (id) => api.post(`/billing/estimates/${id}/convert/`),
  getProfitIntelligence: () => api.get('/billing/profit-intelligence/'),
  getHealthScore: () => api.get('/billing/health-score/'),
  getExpenses: () => api.get('/billing/expenses/'),
  addExpense: (data) => api.post('/billing/expenses/', data),
  deleteExpense: (id) => api.delete(`/billing/expenses/${id}/`),
  getExpenseSummary: (year, month) => api.get(`/billing/expenses/summary/?year=${year}&month=${month}`),
  generateForecasts: () => api.post('/billing/forecasts/generate/'),
  getForecasts: () => api.get('/billing/forecasts/'),
  addCustomer: (data) => api.post('/billing/customers/', data),
  updateCustomer: (id, data) => api.put(`/billing/customers/${id}/`, data),
  deleteCustomer: (id) => api.delete(`/billing/customers/${id}/`),
  getInvoices: () => api.get('/billing/invoices/'),
  createInvoice: (data) => api.post('/billing/invoices/', data),
  getInvoice: (id) => api.get(`/billing/invoices/${id}/`),
  getSummary: () => api.get('/billing/summary/'),
  updateInvoiceStatus: (id, status) => api.patch(`/billing/invoices/${id}/status/`, { status }),
  closeDay: () => api.post('/billing/close-day/'),
  getCashflow: () => api.get('/billing/cashflow/'),
  generateBusinessBrief: () => api.post('/billing/business-brief/'),
  updateSuggestionStatus: (id, status) => api.patch(`/billing/suggestions/${id}/status/`, { status }),
  getInvoiceDetail: (id) => api.get(`/billing/invoices/${id}/`),
  updateInvoice: (id, data) => api.put(`/billing/invoices/${id}/`, data),
  deleteInvoice: (id) => api.delete(`/billing/invoices/${id}/`),
}

export const teamAPI = {
  getRoles: () => api.get('/team/roles/'),
  getMembers: (includeRemoved = false) =>
    api.get(`/team/members/${includeRemoved ? '?include_removed=true' : ''}`),
  inviteMember: (data) => api.post('/team/invite/', data),
  getInviteDetail: (token) => api.get(`/team/invite/${token}/`),
  acceptInvite: (token, data) => api.post(`/team/invite/${token}/accept/`, data),
  suspendMember: (id) => api.patch(`/team/members/${id}/suspend/`),
  reactivateMember: (id) => api.patch(`/team/members/${id}/reactivate/`),
  removeMember: (id) => api.delete(`/team/members/${id}/`),
  changeMemberRole: (id, roleId) => api.patch(`/team/members/${id}/role/`, { role_id: roleId }),

  getActivityLog: ({ action = null, days = null, page = 1, pageSize = 50 } = {}) => {
    const params = new URLSearchParams()
    if (action) params.append('action', action)
    if (days) params.append('days', days)
    params.append('page', page)
    params.append('page_size', pageSize)
    return api.get(`/team/activity/?${params.toString()}`)
  },

  // Phase B.5 — View As Member
  startViewAs: (membershipId) => api.post(`/team/view-as/${membershipId}/start/`),
  endViewAs: () => api.post('/team/view-as/end/'),
  switchViewAsMode: (mode) => api.post('/team/view-as/mode/', { mode }),
  getViewAsStatus: () => api.get('/team/view-as/status/'),

  // Phase B.6 Stage 1 — Primary Owner
  makePrimaryOwner: (membershipId) => api.patch(`/team/members/${membershipId}/make-primary/`),
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
  upgradeTenant: (id, data) => api.put(`/superadmin/tenants/${id}/upgrade/`, data),
  permanentDeleteTenant: (id, data) => api.post(`/superadmin/tenants/${id}/permanent-delete/`, data),
  getDeletionHistory: () => api.get('/superadmin/deletion-history/'),

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