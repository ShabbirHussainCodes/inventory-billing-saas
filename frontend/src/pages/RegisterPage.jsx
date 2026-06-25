import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { authAPI } from "../services/api"

export default function RegisterPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    first_name: "", last_name: "", email: "",
    password: "", business_name: "",
    country: "India", currency: "INR",
    tax_label: "GST", timezone: "Asia/Kolkata"
  })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const response = await authAPI.register(formData)
      const { tokens, user } = response.data
      localStorage.setItem("access_token", tokens.access)
      localStorage.setItem("refresh_token", tokens.refresh)
      localStorage.setItem("user", JSON.stringify(user))
      navigate("/dashboard")
    } catch (err) {
      setError("Registration failed. Please check all fields.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-8">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-lg">

        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600">BillingMars</h1>
          <p className="text-gray-500 mt-2">Create your business account</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name *
              </label>
              <input
                type="text" name="first_name"
                value={formData.first_name} onChange={handleChange}
                placeholder="Shabbir" required
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name *
              </label>
              <input
                type="text" name="last_name"
                value={formData.last_name} onChange={handleChange}
                placeholder="Hussain" required
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Business Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business Name *
            </label>
            <input
              type="text" name="business_name"
              value={formData.business_name} onChange={handleChange}
              placeholder="Sharma Electronics" required
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email" name="email"
              value={formData.email} onChange={handleChange}
              placeholder="sharma@example.com" required
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password *
            </label>
            <input
              type="password" name="password"
              value={formData.password} onChange={handleChange}
              placeholder="Min 8 characters" required
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Country + Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Country
              </label>
              <select
                name="country" value={formData.country}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="India">India</option>
                <option value="UAE">UAE</option>
                <option value="USA">USA</option>
                <option value="UK">UK</option>
                <option value="Singapore">Singapore</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency
              </label>
              <select
                name="currency" value={formData.currency}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="INR">INR — Indian Rupee</option>
                <option value="AED">AED — UAE Dirham</option>
                <option value="USD">USD — US Dollar</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="SGD">SGD — Singapore Dollar</option>
              </select>
            </div>
          </div>

          {/* Tax Label */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tax Type
            </label>
            <select
              name="tax_label" value={formData.tax_label}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="GST">GST — India</option>
              <option value="VAT">VAT — UAE/UK</option>
              <option value="Sales Tax">Sales Tax — USA</option>
              <option value="None">None</option>
            </select>
          </div>

          {/* Submit */}
          <button
            type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{" "}
          <a href="/" className="text-blue-600 hover:underline">
            Sign in here
          </a>
        </p>
      </div>
    </div>
  )
}