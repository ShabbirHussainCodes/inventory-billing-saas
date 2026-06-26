import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"

// Auth-owner (business) app
import LoginPage from "./pages/LoginPage"
import RegisterPage from "./pages/RegisterPage"
import DashboardPage from "./pages/DashboardPage"
import ProductsPage from "./pages/ProductsPage"
import InvoicesPage from "./pages/InvoicesPage"
import CustomersPage from "./pages/CustomersPage"

// Founder Command Center
import RoleRoute from "./components/RoleRoute"
import AdminLayout from "./components/admin/AdminLayout"
import AdminOverview from "./pages/admin/AdminOverview"
import AdminBusinesses from "./pages/admin/AdminBusinesses"
import AdminUsers from "./pages/admin/AdminUsers"
import AdminSettings from "./pages/admin/AdminSettings"

import { getToken } from "./utils/auth"

// Sirf logged-in users (kisi bhi role) ke liye
function ProtectedRoute({ children }) {
  if (!getToken()) {
    return <Navigate to="/" replace />
  }
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
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute>
              <ProductsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/invoices"
          element={
            <ProtectedRoute>
              <InvoicesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customers"
          element={
            <ProtectedRoute>
              <CustomersPage />
            </ProtectedRoute>
          }
        />

        {/* Founder Command Center — nested under one layout, super_admin only */}
        <Route
          element={
            <RoleRoute role="super_admin">
              <AdminLayout />
            </RoleRoute>
          }
        >
          <Route path="/admin" element={<AdminOverview />} />
          <Route path="/admin/businesses" element={<AdminBusinesses />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App