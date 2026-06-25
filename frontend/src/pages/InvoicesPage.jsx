import { useState, useEffect } from "react"
import Layout from "../components/Layout"
import { billingAPI } from "../services/api"

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchInvoices()
  }, [])

  const fetchInvoices = async () => {
    try {
      const res = await billingAPI.getInvoices()
      setInvoices(res.data)
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
          <p className="text-gray-500">Loading invoices...</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Invoices</h2>
          <p className="text-gray-500 mt-1">All your invoices</p>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Invoice No</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Customer</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Date</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Amount</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Tax</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Profit</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                  No invoices yet.
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4">
                    <p className="font-medium text-blue-600">
                      {invoice.invoice_number}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {invoice.customer_name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {invoice.invoice_date}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-gray-800">
                      {invoice.currency} {invoice.total_amount}
                    </p>
                    <p className="text-xs text-gray-500">
                      {invoice.tax_label}: {invoice.currency} {invoice.tax_amount}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {invoice.currency} {invoice.tax_amount}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-green-600">
                      {invoice.currency} {invoice.total_profit}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      invoice.status === "paid"
                        ? "bg-green-100 text-green-600"
                        : invoice.status === "sent"
                        ? "bg-yellow-100 text-yellow-600"
                        : invoice.status === "cancelled"
                        ? "bg-red-100 text-red-600"
                        : "bg-gray-100 text-gray-600"
                    }`}>
                      {invoice.status}
                    </span>
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