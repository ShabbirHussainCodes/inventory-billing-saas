import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { authAPI } from "../services/api"

// Login ke baad tokens save karo aur role ke hisaab se sahi jagah bhejo
function finishLogin(navigate, tokens, user) {
  localStorage.setItem("access_token", tokens.access)
  localStorage.setItem("refresh_token", tokens.refresh)
  localStorage.setItem("user", JSON.stringify(user))

  if (user.role === "super_admin") {
    navigate("/admin")
  } else {
    navigate("/dashboard")
  }
}

// ─── Business selection screen ────────────────────────────────────────────
// Sirf tab dikhta hai jab ek staff 2+ businesses ka member ho — login()
// turant tokens nahi deta, pehle "kaunse business mein kaam karna hai"
// choose karwata hai.

function BusinessSelection({ businesses, temporaryToken, onDone, onExpired }) {
  const navigate = useNavigate()
  const [selectingId, setSelectingId] = useState(null)
  const [error, setError] = useState("")

  const handleSelect = async (tenantId) => {
    setSelectingId(tenantId)
    setError("")
    try {
      const response = await authAPI.selectBusiness({
        temporary_token: temporaryToken,
        tenant_id: tenantId,
      })
      const { tokens, user } = response.data
      finishLogin(navigate, tokens, user)
      onDone()
    } catch (err) {
      const status = err?.response?.status
      const msg = err?.response?.data?.error

      // Token 2 minute mein expire ho jaata hai — wapas login screen pe bhejo
      if (status === 401) {
        onExpired("Your session expired. Please log in again.")
        return
      }
      setError(msg || "Something went wrong. Please try again.")
      setSelectingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Select a business</h1>
          <p className="text-gray-500 mt-2 text-sm">
            You're a member of multiple businesses. Choose which one to work in.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {businesses.map((biz) => (
            <button
              key={biz.id}
              onClick={() => handleSelect(biz.id)}
              disabled={selectingId !== null}
              className="w-full text-left border border-gray-200 rounded-lg px-4 py-3 hover:border-blue-500 hover:bg-blue-50 transition disabled:opacity-50 flex items-center justify-between"
            >
              <span className="font-medium text-gray-800">{biz.name}</span>
              {selectingId === biz.id && (
                <span className="text-sm text-blue-600">Signing in…</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main login page ───────────────────────────────────────────────────────

export default function LoginPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Multi-business selection state — null matlab abhi credentials screen dikh rahi hai
  const [pendingSelection, setPendingSelection] = useState(null) // { temporaryToken, businesses }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    localStorage.clear()

    try {
      const response = await authAPI.login(formData)

      // Multi-tenant staff — turant tokens nahi mile, business choose karna hai
      if (response.data.temporary_token) {
        setPendingSelection({
          temporaryToken: response.data.temporary_token,
          businesses: response.data.businesses,
        })
        setLoading(false)
        return
      }

      const { tokens, user } = response.data
      finishLogin(navigate, tokens, user)
    } catch (err) {
      const msg = err?.response?.data?.error
      setError(msg || "Invalid email or password. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (pendingSelection) {
    return (
      <BusinessSelection
        businesses={pendingSelection.businesses}
        temporaryToken={pendingSelection.temporaryToken}
        onDone={() => setPendingSelection(null)}
        onExpired={(msg) => {
          setPendingSelection(null)
          setError(msg)
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600">BillingMars</h1>
          <p className="text-gray-500 mt-2">Sign in to your account</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="ahmed@example.com"
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Don't have an account?{" "}
          <a href="/register" className="text-blue-600 hover:underline">
            Register here
          </a>
        </p>
      </div>
    </div>
  )
}
