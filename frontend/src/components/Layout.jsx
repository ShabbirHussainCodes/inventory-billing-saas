import { useState } from "react"
import { useNavigate, useLocation, Link } from "react-router-dom"

export default function Layout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const user = JSON.parse(localStorage.getItem("user") || "{}")

  const handleLogout = () => {
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
    localStorage.removeItem("user")
    navigate("/")
  }

  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: "📊" },
    { path: "/products", label: "Products", icon: "📦" },
    { path: "/invoices", label: "Invoices", icon: "🧾" },
    { path: "/customers", label: "Customers", icon: "👥" },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* Sidebar */}
      <div className="w-64 bg-white shadow-sm flex flex-col">

        {/* Logo */}
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-blue-600">BillingMars</h1>
          <p className="text-xs text-gray-500 mt-1">{user.email}</p>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${
                location.pathname === item.path
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition"
          >
            <span>🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-auto">
        {children}
      </div>
    </div>
  )
}