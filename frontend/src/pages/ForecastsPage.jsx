import { useState, useEffect } from "react"
import Layout from "../components/Layout"
import { billingAPI } from "../services/api"

const PATTERN_CFG = {
  dense:              { label: "Regular Seller",  cls: "bg-green-50 text-green-700" },
  intermittent:       { label: "Occasional Seller", cls: "bg-amber-50 text-amber-700" },
  insufficient_data:  { label: "Not Enough Data",  cls: "bg-gray-100 text-gray-500" },
}

function PatternBadge({ pattern }) {
  const cfg = PATTERN_CFG[pattern] || { label: pattern, cls: "bg-gray-100 text-gray-500" }
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
}

export default function ForecastsPage() {
  const [forecasts, setForecasts] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [toast, setToast] = useState('')

  const fetchForecasts = () => {
    setLoading(true)
    billingAPI.getForecasts()
      .then(res => setForecasts(res.data.results))
      .catch(() => setToast('Could not load forecasts.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchForecasts() }, [])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await billingAPI.generateForecasts()
      const telegramNote = res.data.telegram_sent
        ? ' + sent to Telegram ✓'
        : (res.data.telegram_error ? ' (Telegram not sent — check Settings)' : '')
      setToast(res.data.message + telegramNote)
      fetchForecasts()
    } catch (err) {
      setToast(err?.response?.data?.error || 'Could not generate forecasts.')
    } finally {
      setGenerating(false)
      setTimeout(() => setToast(''), 4000)
    }
  }

  return (
    <Layout>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Demand Forecast</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Predicted daily sales per product, based on your actual sales history
          </p>
        </div>
        <button onClick={handleGenerate} disabled={generating}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50">
          {generating ? "Calculating…" : "Generate Forecast"}
        </button>
      </div>

      {/* Honest methodology note — always visible, not hidden in fine print */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 mb-4">
        <p className="text-xs text-blue-800">
          ℹ️ Products are automatically classified: <strong>Regular Sellers</strong> (sell most days)
          use a 14-day moving average. <strong>Occasional Sellers</strong> (sell rarely) use Croston's
          method, designed specifically for sparse demand — a plain average would be misleading for
          these. Products with fewer than 3 recorded sales show <strong>"Not Enough Data"</strong> instead
          of a fabricated number.
        </p>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-gray-100" />)}
        </div>
      ) : forecasts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-sm font-medium text-gray-900 mb-1">No forecasts generated yet</p>
          <button onClick={handleGenerate} className="mt-2 text-sm text-blue-600 hover:underline">
            Generate your first forecast →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {forecasts.map(f => (
            <div key={f.id} className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm font-medium text-gray-900">{f.product_name}</p>
                <PatternBadge pattern={f.pattern_type} />
              </div>
              {f.forecast_daily_rate !== null ? (
                <p className="text-lg font-semibold text-gray-900 mb-1">
                  {parseFloat(f.forecast_daily_rate).toFixed(2)} <span className="text-xs font-normal text-gray-400">units/day (predicted)</span>
                </p>
              ) : (
                <p className="text-sm text-gray-400 mb-1">No forecast available</p>
              )}
              <p className="text-xs text-gray-500">{f.note}</p>
              <p className="text-[10px] text-gray-300 mt-1">
                Based on {f.data_points_used} days of history
              </p>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </Layout>
  )
}