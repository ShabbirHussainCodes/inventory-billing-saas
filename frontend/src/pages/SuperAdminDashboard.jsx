import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { authAPI } from "../services/api"

export default function SuperAdminDashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)

  useEffect(() => {
    // Check karo — sirf super_admin aa sake
    const userData = localStorage.getItem("user")
    if (userData) {
      const parsed = JSON.parse(userData)
      if (parsed.role !== "super_admin") {
        navigate("/dashboard")
        return
      }
      setUser(parsed)
    } else {
      navigate("/")
    }
  }, [navigate])

  const handleLogout = () => {
    localStorage.clear()
    navigate("/")
  }

  return (
    <div className="min-h-screen bg-gray-100">

      {/* Top Navbar */}
      <div className="bg-white shadow px-8 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-blue-600">
          BillingMars — Super Admin
        </h1>
        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition"
        >
          Logout
        </button>
      </div>

      {/* Main Content */}
      <div className="p-8">

        {/* Welcome */}
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          👑 Welcome, {user?.first_name || "Super Admin"}!
        </h2>
        <p className="text-gray-500 mb-8">
          You have full access to BillingMars platform.
        </p>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

          <div className="bg-white rounded-2xl shadow p-6">
            <p className="text-gray-500 text-sm">Total Businesses</p>
            <p className="text-4xl font-bold text-blue-600 mt-2">—</p>
            <p className="text-xs text-gray-400 mt-1">Coming soon</p>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <p className="text-gray-500 text-sm">Total Users</p>
            <p className="text-4xl font-bold text-green-600 mt-2">—</p>
            <p className="text-xs text-gray-400 mt-1">Coming soon</p>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <p className="text-gray-500 text-sm">Active Subscriptions</p>
            <p className="text-4xl font-bold text-purple-600 mt-2">—</p>
            <p className="text-xs text-gray-400 mt-1">Coming soon</p>
          </div>

        </div>

        {/* Info Box */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">
            🚧 Super Admin APIs Coming Soon
          </h3>
          <p className="text-yellow-700 text-sm">
            Jald hi yahan sab tenants, users, aur subscriptions ka data dikhega!
          </p>
        </div>

      </div>
    </div>
  )
}