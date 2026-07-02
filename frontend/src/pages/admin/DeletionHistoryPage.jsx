import { useState, useEffect } from "react"
import { superAdminAPI } from "../../services/api"

// ─── Time helper ──────────────────────────────────────────────────────────────

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-gray-100" />)}
    </div>
  )
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function DeletionHistoryPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    superAdminAPI.getDeletionHistory()
      .then(res => setLogs(res.data.results || []))
      .catch(() => setError("Could not load deletion history."))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-base font-semibold text-gray-900">Deletion History</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Permanent record of businesses deleted from the platform — survives even after the business itself is gone.
        </p>
      </div>

      {loading ? (
        <Skeleton />
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-sm font-medium text-gray-900 mb-1">No businesses deleted yet</p>
          <p className="text-xs text-gray-400">
            When you permanently delete a business, a record appears here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map(log => (
            <div key={log.id} className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{log.tenant_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {log.owner_email || 'No owner email on record'}
                  </p>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(log.deleted_at)}</span>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="rounded-lg bg-gray-50 px-2 py-1.5 text-center">
                  <p className="text-sm font-semibold text-gray-800">{log.products_count}</p>
                  <p className="text-[10px] text-gray-400">Products</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-2 py-1.5 text-center">
                  <p className="text-sm font-semibold text-gray-800">{log.customers_count}</p>
                  <p className="text-[10px] text-gray-400">Customers</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-2 py-1.5 text-center">
                  <p className="text-sm font-semibold text-gray-800">{log.invoices_count}</p>
                  <p className="text-[10px] text-gray-400">Invoices</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-2 py-1.5 text-center">
                  <p className="text-sm font-semibold text-gray-800">{log.users_count}</p>
                  <p className="text-[10px] text-gray-400">Users</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-100">
                <span className="text-gray-500">
                  Deleted by <span className="text-gray-700 font-medium">{log.deleted_by_email || 'Unknown'}</span>
                </span>
                {log.reason && (
                  <span className="text-gray-400 italic">"{log.reason}"</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}