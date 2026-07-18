import { useState, useEffect } from "react"
import Layout from "../components/Layout"
import { billingAPI, isPlanLimitError, getPlanLimitMessage } from "../services/api"

const SYM = { INR: '₹', USD: '$', AED: 'AED ', GBP: '£', EUR: '€' }

function fmt(amount, currency) {
  const sym = SYM[currency] || currency + ' '
  return `${sym}${parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function ProductRow({ product, currency, tone }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{product.product_name}</p>
        <p className="text-xs text-gray-400">{product.total_quantity} units sold · Revenue {fmt(product.total_revenue, currency)}</p>
      </div>
      <p className={`text-sm font-semibold flex-shrink-0 ml-3 ${tone === 'loss' ? 'text-red-600' : 'text-green-600'}`}>
        {fmt(product.total_profit, currency)}
      </p>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-24 rounded-2xl bg-gray-100" />
      <div className="h-64 rounded-2xl bg-gray-100" />
      <div className="h-64 rounded-2xl bg-gray-100" />
    </div>
  )
}

export default function ProfitIntelligencePage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    billingAPI.getProfitIntelligence()
      .then(res => setData(res.data))
      .catch(err => setError(
        isPlanLimitError(err) ? getPlanLimitMessage(err) : 'Could not load profit intelligence.'
      ))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Layout>
      <div className="mb-5">
        <h2 className="text-base font-semibold text-gray-900">Profit Intelligence</h2>
        <p className="text-xs text-gray-400 mt-0.5">Which products actually make you money — based on completed sales only</p>
      </div>

      {loading ? (
        <Skeleton />
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : (
        <div className="space-y-4">

          {/* Margin trend — this month vs last month */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-xs text-gray-400 mb-1">This Month</p>
              <p className="text-2xl font-semibold text-gray-900">{fmt(data.this_month.profit, data.currency)}</p>
              <p className="text-xs text-gray-500 mt-1">
                Revenue {fmt(data.this_month.revenue, data.currency)}
                {' · '}
                Margin: {data.this_month.margin_percent !== null ? `${data.this_month.margin_percent}%` : '—'}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-xs text-gray-400 mb-1">Last Month</p>
              <p className="text-2xl font-semibold text-gray-500">{fmt(data.last_month.profit, data.currency)}</p>
              <p className="text-xs text-gray-500 mt-1">
                Revenue {fmt(data.last_month.revenue, data.currency)}
                {' · '}
                Margin: {data.last_month.margin_percent !== null ? `${data.last_month.margin_percent}%` : '—'}
              </p>
            </div>
          </div>

          {/* Top profitable products */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-medium text-gray-900 mb-1">🏆 Most Profitable Products</p>
            <p className="text-xs text-gray-400 mb-3">Based on all completed (sent/paid) invoices</p>
            {data.top_products.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No completed sales yet.</p>
            ) : (
              <div>
                {data.top_products.map((p, i) => (
                  <ProductRow key={p.product_id || i} product={p} currency={data.currency} tone="profit" />
                ))}
              </div>
            )}
          </div>

          {/* Loss-making products — only shown if any exist */}
          {data.bottom_products.length > 0 && (
            <div className="rounded-2xl border border-red-100 bg-red-50/40 p-5">
              <p className="text-sm font-medium text-red-800 mb-1">⚠️ Losing Money On These</p>
              <p className="text-xs text-red-500 mb-3">Selling price is below cost on these products, after discounts</p>
              <div>
                {data.bottom_products.map((p, i) => (
                  <ProductRow key={p.product_id || i} product={p} currency={data.currency} tone="loss" />
                ))}
              </div>
            </div>
          )}

          {/* Category breakdown */}
          {data.by_category.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-sm font-medium text-gray-900 mb-3">By Category</p>
              <div className="space-y-2">
                {data.by_category.map((c, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <p className="text-sm text-gray-700">{c.category_name}</p>
                    <p className="text-sm font-medium text-gray-900">{fmt(c.total_profit, data.currency)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Layout>
  )
}