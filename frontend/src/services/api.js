import axios from 'axios'

// Django backend ka address
const BASE_URL = 'https://billingmars-api.onrender.com/api'

// Axios instance banao
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Har request mein JWT token automatically add karo
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Authentication APIs
export const authAPI = {
  login: (data) => api.post('/auth/login/', data),
  register: (data) => api.post('/auth/register/', data),
  logout: (data) => api.post('/auth/logout/', data),
  profile: () => api.get('/auth/profile/'),
}

// Inventory APIs
export const inventoryAPI = {
  getProducts: () => api.get('/inventory/products/'),
  addProduct: (data) => api.post('/inventory/products/', data),
  getProduct: (id) => api.get(`/inventory/products/${id}/`),
  updateProduct: (id, data) => api.put(`/inventory/products/${id}/`, data),
  deleteProduct: (id) => api.delete(`/inventory/products/${id}/`),
  getLowStock: () => api.get('/inventory/low-stock/'),
  addStockMovement: (data) => api.post('/inventory/stock-movement/', data),
  getCategories: () => api.get('/inventory/categories/'),
  getSuppliers: () => api.get('/inventory/suppliers/'),
}

// Billing APIs
export const billingAPI = {
  getCustomers: () => api.get('/billing/customers/'),
  addCustomer: (data) => api.post('/billing/customers/', data),
  getInvoices: () => api.get('/billing/invoices/'),
  createInvoice: (data) => api.post('/billing/invoices/', data),
  getInvoice: (id) => api.get(`/billing/invoices/${id}/`),
  getSummary: () => api.get('/billing/summary/'),
}

// Super Admin APIs — Founder Command Center
export const superAdminAPI = {
  // Platform stats — Overview KPIs
  getStats: () => api.get('/superadmin/stats/'),

  // Businesses (tenants)
  getTenants: () => api.get('/superadmin/tenants/'),
  toggleTenant: (id) => api.put(`/superadmin/tenants/${id}/toggle/`),
  grantAccess: (id) => api.put(`/superadmin/tenants/${id}/grant-access/`),
  upgradeTenant: (id) => api.put(`/superadmin/tenants/${id}/upgrade/`),

  // Users
  getUsers: () => api.get('/superadmin/users/'),
  toggleUser: (id) => api.put(`/superadmin/users/${id}/toggle/`),
  resetPassword: (id, data) => api.post(`/superadmin/users/${id}/reset-password/`, data),
}

export default api