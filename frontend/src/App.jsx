import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"

// Business owner app
import LoginPage from "./pages/LoginPage"
import RegisterPage from "./pages/RegisterPage"
import DashboardPage from "./pages/DashboardPage"
import ProductsPage from "./pages/ProductsPage"
import InvoicesPage from "./pages/InvoicesPage"
import CustomersPage from "./pages/CustomersPage"
import CreateInvoicePage from "./pages/CreateInvoicePage"
import EditInvoicePage from "./pages/EditInvoicePage"
import InvoiceDetailPage from "./pages/InvoiceDetailPage"
import SettingsPage from "./pages/SettingsPage"
import CategoriesSuppliersPage from "./pages/CategoriesSuppliersPage"
import StockHistoryPage from "./pages/StockHistoryPage"

// Founder Command Center (with AdminLayout sidebar)
import RoleRoute from "./components/RoleRoute"
import AdminLayout from "./components/admin/AdminLayout"
import AdminOverview from "./pages/admin/AdminOverview"
import AdminBusinesses from "./pages/admin/AdminBusinesses"
import AdminUsers from "./pages/admin/AdminUsers"
import AdminSettings from "./pages/admin/AdminSettings"
import AuditLogPage from "./pages/admin/AuditLogPage"
import DeletionHistoryPage from "./pages/admin/DeletionHistoryPage"
import AdminAnalyticsPage from "./pages/admin/AdminAnalyticsPage"

// Business Workspace (own full-screen layout — no admin sidebar)
import BusinessWorkspacePage from "./pages/admin/BusinessWorkspacePage"

import { getToken } from "./utils/auth"

function ProtectedRoute({ children }) {
  if (!getToken()) return <Navigate to="/" replace />
  return children
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Business owner / staff */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute><ProductsPage /></ProtectedRoute>} />
        <Route path="/invoices" element={<ProtectedRoute><InvoicesPage /></ProtectedRoute>} />
        <Route path="/invoices/create" element={<ProtectedRoute><CreateInvoicePage /></ProtectedRoute>} />
        <Route path="/invoices/edit/:id" element={<ProtectedRoute><EditInvoicePage /></ProtectedRoute>} />
        <Route path="/invoices/:id" element={<ProtectedRoute><InvoiceDetailPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute><CategoriesSuppliersPage /></ProtectedRoute>} />
        <Route path="/stock-history" element={<ProtectedRoute><StockHistoryPage /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute><CustomersPage /></ProtectedRoute>} />

        {/* Founder Command Center — AdminLayout sidebar ke saath */}
        <Route element={<RoleRoute role="super_admin"><AdminLayout /></RoleRoute>}>
          <Route path="/admin" element={<AdminOverview />} />
          <Route path="/admin/businesses" element={<AdminBusinesses />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
          <Route path="/admin/audit" element={<AuditLogPage />} />
          <Route path="/admin/deletions" element={<DeletionHistoryPage />} />
          <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
        </Route>

        {/* Business Workspace — apna full-screen layout, admin sidebar nahi
            RoleRoute guard hai — sirf super_admin access kar sake */}
        <Route
          path="/admin/businesses/:id"
          element={
            <RoleRoute role="super_admin">
              <BusinessWorkspacePage />
            </RoleRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App