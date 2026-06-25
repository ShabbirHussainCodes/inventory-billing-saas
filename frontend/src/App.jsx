import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import LoginPage from "./pages/LoginPage"
import DashboardPage from "./pages/DashboardPage"
import ProductsPage from "./pages/ProductsPage"
import InvoicesPage from "./pages/InvoicesPage"
import CustomersPage from "./pages/CustomersPage"

// Protected Route
function ProtectedRoute({ children }) {
  const token = localStorage.getItem("access_token")
  if (!token) {
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

        {/* Protected */}
        <Route path="/dashboard" element={
          <ProtectedRoute><DashboardPage /></ProtectedRoute>
        } />
        <Route path="/products" element={
          <ProtectedRoute><ProductsPage /></ProtectedRoute>
        } />
        <Route path="/invoices" element={
          <ProtectedRoute><InvoicesPage /></ProtectedRoute>
        } />
        <Route path="/customers" element={
          <ProtectedRoute><CustomersPage /></ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App