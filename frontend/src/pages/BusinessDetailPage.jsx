import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import api from "../services/api"

export default function BusinessDetailPage() {
  const { tenantId } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState("products")
  const [businessName, setBusinessName] = useState("")
  const [products, setProducts] = useState([])
  const [invoices, setInvoices] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAllData()
  }, [tenantId])

  const fetchAllData = async () => {
    try {
      const [prodRes, invRes, custRes] = await Promise.all([
        api.get(`/superadmin/tenants/${tenantId}/products/`),
        api.get(`/superadmin/tenants/${tenantId}/invoices/`),
        api.get(`/superadmin/tenants/${tenantId}/customers/`),
      ])
      setBusinessName(prodRes.data.tenant)
      setProducts(prodRes.data.products)
      setInvoices(invRes.data.invoices)
      setCustomers(custRes.data.customers)
    } catch (err) {
      console.error("Error fetching business data:", err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500 text-lg">Loading business data...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">

      {/* Header */}
      <div className="bg-white shadow px-8 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-blue-600">
            🏪 {businessName}
          </h1>
          <p className="text-xs text-gray-500">Business Detail View — Super Admin</p>
        </div>
        <button
          onClick={() => navigate("/superadmin")}
          className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition text-sm"
        >
          ← Back to Admin
        </button>
      </div>

      <div className="p-8">

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          {[
            { key: "products", label: "📦 Products", count: products.length },
            { key: "invoices", label: "🧾 Invoices", count: invoices.length },
            { key: "customers", label: "👥 Customers", count: customers.length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50 shadow"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Products Tab */}
        {activeTab === "products" && (
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Product</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">SKU</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Cost</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Sell</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Margin</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Stock</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                      No products yet.
                    </td>
                  </tr>
                ) : (
                  products.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-800">{p.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{p.sku}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{p.cost_price}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{p.selling_price}</td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-green-600">
                          {p.profit_margin}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{p.stock_quantity}</td>
                      <td className="px-6 py-4">
                        {p.is_low_stock ? (
                          <span className="px-2 py-1 bg-red-100 text-red-600 rounded-full text-xs font-medium">
                            Low Stock 🔴
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-green-100 text-green-600 rounded-full text-xs font-medium">
                            In Stock ✅
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Invoices Tab */}
        {activeTab === "invoices" && (
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Invoice No</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Customer</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Date</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Amount</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Profit</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                      No invoices yet.
                    </td>
                  </tr>
                ) : (
                  invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-blue-600">{inv.invoice_number}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{inv.customer_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{inv.invoice_date}</td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-800">
                        {inv.currency} {inv.total_amount}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-green-600">
                        {inv.currency} {inv.total_profit}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          inv.status === "paid"
                            ? "bg-green-100 text-green-600"
                            : inv.status === "sent"
                            ? "bg-yellow-100 text-yellow-600"
                            : "bg-gray-100 text-gray-600"
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Customers Tab */}
        {activeTab === "customers" && (
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Name</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Email</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Phone</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Country</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                      No customers yet.
                    </td>
                  </tr>
                ) : (
                  customers.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-800">{c.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{c.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{c.phone}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{c.country}</td>
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