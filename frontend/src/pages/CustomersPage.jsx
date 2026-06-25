import { useState, useEffect } from "react"
import Layout from "../components/Layout"
import { billingAPI } from "../services/api"

export default function CustomersPage() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCustomers()
  }, [])

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
          <p className="text-gray-500 mt-1">
            Manage your customers
          </p>
        </div>
      </div>

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
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-800">{customer.name}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {customer.email || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {customer.phone || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {customer.country || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {customer.tax_number || "—"}
                  </td>
                  <td className="px-6 py-4">
                    {customer.is_active ? (
                      <span className="px-2 py-1 bg-green-100 text-green-600 rounded-full text-xs font-medium">
                        Active ✅
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-red-100 text-red-600 rounded-full text-xs font-medium">
                        Inactive ❌
                      </span>
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