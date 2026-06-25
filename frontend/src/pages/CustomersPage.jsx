import { useState, useEffect } from "react"
import Layout from "../components/Layout"
import { billingAPI } from "../services/api"

export default function CustomersPage() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: "", email: "", phone: "",
    address: "", tax_number: "", country: ""
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => { fetchCustomers() }, [])

  const fetchCustomers = async () => {
    try {
      const res = await billingAPI.getCustomers()
      setCustomers(res.data)
    } catch (err) {
      console.error("Error:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      await billingAPI.addCustomer(formData)
      setShowForm(false)
      setFormData({
        name: "", email: "", phone: "",
        address: "", tax_number: "", country: ""
      })
      fetchCustomers()
    } catch (err) {
      setError("Failed to add customer. Please check all fields.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Loading customers...</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Customers</h2>
          <p className="text-gray-500 mt-1">Manage your customers</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          {showForm ? "Cancel" : "+ Add Customer"}
        </button>
      </div>

      {/* Add Customer Form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Add New Customer
          </h3>
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text" name="name"
                  value={formData.name} onChange={handleChange}
                  placeholder="Ramesh Kumar"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email" name="email"
                  value={formData.email} onChange={handleChange}
                  placeholder="ramesh@example.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="text" name="phone"
                  value={formData.phone} onChange={handleChange}
                  placeholder="+971501234567"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Country
                </label>
                <input
                  type="text" name="country"
                  value={formData.country} onChange={handleChange}
                  placeholder="UAE"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tax Number (GST/VAT)
                </label>
                <input
                  type="text" name="tax_number"
                  value={formData.tax_number} onChange={handleChange}
                  placeholder="VAT-123456"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  type="text" name="address"
                  value={formData.address} onChange={handleChange}
                  placeholder="Dubai Marina, UAE"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                type="submit" disabled={saving}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Customer"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="border border-gray-300 text-gray-600 px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Customers Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Name</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Email</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Phone</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Country</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Tax Number</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customers.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                  No customers yet.
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 font-medium text-gray-800">{customer.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{customer.email || "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{customer.phone || "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{customer.country || "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{customer.tax_number || "—"}</td>
                  <td className="px-6 py-4">
                    {customer.is_active ? (
                      <span className="px-2 py-1 bg-green-100 text-green-600 rounded-full text-xs font-medium">Active ✅</span>
                    ) : (
                      <span className="px-2 py-1 bg-red-100 text-red-600 rounded-full text-xs font-medium">Inactive ❌</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}