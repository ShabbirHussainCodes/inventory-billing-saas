import { useState, useEffect } from "react"
import Layout from "../components/Layout"
import { billingAPI, inventoryAPI } from "../services/api"

function StatCard({ title, value, icon, color }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

export default function DashboardPage() {
  const [summary, setSummary] = useState(null)
  const [lowStock, setLowStock] = useState([])
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const user = JSON.parse(localStorage.getItem("user") || "{}")

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [summaryRes, lowStockRes, invoicesRes] = await Promise.all([
        billingAPI.getSummary(),
        inventoryAPI.getLowStock(),
        billingAPI.getInvoices(),
      ])
      setSummary(summaryRes.data)
      setLowStock(lowStockRes.data.products)
      setInvoices(invoicesRes.data.slice(0, 5))
    } catch (err) {
      console.error("Error fetching dashboard data:", err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Loading...</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">
          Welcome back, {user.first_name}! 👋
        </h2>
        <p className="text-gray-500 mt-1">
          Here's what's happening with your business today.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Revenue"
          value={`${summary?.currency} ${summary?.total_revenue?.toFixed(2) || "0.00"}`}
          icon="💰"
          color="text-green-600"
        />
        <StatCard
          title="Total Profit"
          value={`${summary?.currency} ${summary?.total_profit?.toFixed(2) || "0.00"}`}
          icon="📈"
          color="text-blue-600"
        />
        <StatCard
          title="Total Invoices"
          value={summary?.total_invoices || 0}
          icon="🧾"
          color="text-purple-600"
        />
        <StatCard
          title="Paid Invoices"
          value={summary?.paid_invoices || 0}
          icon="✅"
          color="text-teal-600"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">

        {/* Low Stock Alert */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            ⚠️ Low Stock Alerts
          </h3>
          {lowStock.length === 0 ? (
            <p className="text-gray-500 text-sm">
              All products are well stocked! ✅
            </p>
          ) : (
            <div className="space-y-3">
              {lowStock.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 bg-red-50 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {product.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      SKU: {product.sku}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-600">
                      {product.stock_quantity} left
                    </p>
                    <p className="text-xs text-gray-500">
                      Min: {product.reorder_point}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Invoices */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            🧾 Recent Invoices
          </h3>
          {invoices.length === 0 ? (
            <p className="text-gray-500 text-sm">No invoices yet.</p>
          ) : (
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {invoice.invoice_number}
                    </p>
                    <p className="text-xs text-gray-500">
                      {invoice.customer_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-800">
                      {invoice.currency} {invoice.total_amount}
                    </p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      invoice.status === "paid"
                        ? "bg-green-100 text-green-600"
                        : "bg-yellow-100 text-yellow-600"
                    }`}>
                      {invoice.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}