import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import api from "../services/api"

export default function SuperAdminDashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState(null)
  const [tenants, setTenants] = useState([])
  const [users, setUsers] = useState([])
  const [activeTab, setActiveTab] = useState("overview")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (userData) {
      const parsed = JSON.parse(userData)
      if (parsed.role !== "super_admin") {
        navigate("/dashboard")
        return
      }
      setUser(parsed)
      fetchData()
    } else {
      navigate("/")
    }
  }, [navigate])

  const fetchData = async () => {
    try {
      const [statsRes, tenantsRes, usersRes] = await Promise.all([
        api.get('/superadmin/stats/'),
        api.get('/superadmin/tenants/'),
        api.get('/superadmin/users/'),
      ])
      setStats(statsRes.data)
      setTenants(tenantsRes.data)
      setUsers(usersRes.data)
    } catch (err) {
      console.error("Error fetching admin data:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleTenant = async (tenantId) => {
    try {
      const res = await api.put(`/superadmin/tenants/${tenantId}/toggle/`)
      setTenants(tenants.map(t =>
        t.id === tenantId ? { ...t, is_active: res.data.is_active } : t
      ))
    } catch (err) {
      console.error("Error toggling tenant:", err)
    }
  }

  const handleGrantAccess = async (tenantId) => {
    try {
      await api.put(`/superadmin/tenants/${tenantId}/grant-access/`)
      setTenants(tenants.map(t =>
        t.id === tenantId ? { ...t, access_type: 'admin_grant', is_active: true } : t
      ))
      alert("Free access granted successfully!")
    } catch (err) {
      console.error("Error granting access:", err)
    }
  }

  const handleToggleUser = async (userId) => {
    try {
      const res = await api.put(`/superadmin/users/${userId}/toggle/`)
      setUsers(users.map(u =>
        u.id === userId ? { ...u, is_active: res.data.is_active } : u
      ))
    } catch (err) {
      console.error("Error toggling user:", err)
    }
  }

  const handleLogout = () => {
    localStorage.clear()
    navigate("/")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500 text-lg">Loading Super Admin Panel...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">

      {/* Top Navbar */}
      <div className="bg-white shadow px-8 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-blue-600">
            BillingMars — Super Admin
          </h1>
          <p className="text-xs text-gray-500">
            👑 {user?.email}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition text-sm"
        >
          Logout
        </button>
      </div>

      <div className="p-8">

        {/* Welcome */}
        <h2 className="text-2xl font-semibold text-gray-800 mb-6">
          👑 Welcome, {user?.first_name || "Super Admin"}!
        </h2>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-500 text-sm">Total Businesses</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">
              {stats?.total_tenants || 0}
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-500 text-sm">Active Businesses</p>
            <p className="text-3xl font-bold text-green-600 mt-1">
              {stats?.active_tenants || 0}
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-500 text-sm">Total Users</p>
            <p className="text-3xl font-bold text-purple-600 mt-1">
              {stats?.total_users || 0}
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow p-5">
            <p className="text-gray-500 text-sm">Paid Clients</p>
            <p className="text-3xl font-bold text-orange-600 mt-1">
              {stats?.paid_tenants || 0}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          {["overview", "tenants", "users"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition ${activeTab === tab
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50 shadow"
                }`}
            >
              {tab === "overview" ? "📊 Overview" :
                tab === "tenants" ? "🏪 Businesses" : "👥 Users"}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl shadow p-6">
              <p className="text-gray-500 text-sm mb-1">Free Tier</p>
              <p className="text-3xl font-bold text-gray-700">
                {stats?.free_tenants || 0}
              </p>
              <p className="text-xs text-gray-400 mt-1">businesses on free plan</p>
            </div>
            <div className="bg-white rounded-2xl shadow p-6">
              <p className="text-gray-500 text-sm mb-1">Admin Grant</p>
              <p className="text-3xl font-bold text-yellow-600">
                {stats?.admin_grant_tenants || 0}
              </p>
              <p className="text-xs text-gray-400 mt-1">manually granted by you</p>
            </div>
            <div className="bg-white rounded-2xl shadow p-6">
              <p className="text-gray-500 text-sm mb-1">Inactive</p>
              <p className="text-3xl font-bold text-red-500">
                {stats?.inactive_tenants || 0}
              </p>
              <p className="text-xs text-gray-400 mt-1">deactivated businesses</p>
            </div>
          </div>
        )}

        {/* Tenants Tab */}
        {activeTab === "tenants" && (
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Business</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Country</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Currency</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Users</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Access</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Status</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tenants.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                      No businesses yet.
                    </td>
                  </tr>
                ) : (
                  tenants.map(tenant => (
                    <tr key={tenant.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-800">{tenant.name}</p>
                        <p className="text-xs text-gray-400">{tenant.tax_label}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{tenant.country}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{tenant.currency}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{tenant.users_count}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${tenant.access_type === 'paid'
                            ? 'bg-green-100 text-green-600'
                            : tenant.access_type === 'admin_grant'
                              ? 'bg-yellow-100 text-yellow-600'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                          {tenant.access_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${tenant.is_active
                            ? 'bg-green-100 text-green-600'
                            : 'bg-red-100 text-red-600'
                          }`}>
                          {tenant.is_active ? 'Active ✅' : 'Inactive ❌'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => navigate(`/superadmin/business/${tenant.id}`)}
                          className="px-3 py-1 rounded-lg text-xs font-medium bg-blue-100 text-blue-600 hover:bg-blue-200 transition"
                        >
                          View 👁️
                        </button>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleToggleTenant(tenant.id)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${tenant.is_active
                                ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                : 'bg-green-100 text-green-600 hover:bg-green-200'
                              }`}
                          >
                            {tenant.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          {tenant.access_type !== 'admin_grant' && (
                            <button
                              onClick={() => handleGrantAccess(tenant.id)}
                              className="px-3 py-1 rounded-lg text-xs font-medium bg-yellow-100 text-yellow-600 hover:bg-yellow-200 transition"
                            >
                              Grant Free
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Name</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Email</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Business</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Role</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Status</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                      No users yet.
                    </td>
                  </tr>
                ) : (
                  users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-800">
                          {u.first_name} {u.last_name}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{u.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{u.tenant_name}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-blue-100 text-blue-600 rounded-full text-xs font-medium">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.is_active
                            ? 'bg-green-100 text-green-600'
                            : 'bg-red-100 text-red-600'
                          }`}>
                          {u.is_active ? 'Active ✅' : 'Inactive ❌'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleUser(u.id)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition ${u.is_active
                              ? 'bg-red-100 text-red-600 hover:bg-red-200'
                              : 'bg-green-100 text-green-600 hover:bg-green-200'
                            }`}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}