import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import Layout from "../components/Layout"
import { inventoryAPI } from "../services/api"

// ─── Time helper ──────────────────────────────────────────────────────────────

function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(isoString).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

// ─── Movement type config ──────────────────────────────────────────────────────

const TYPE_CFG = {
  in:         { label: "Stock In",   bg: "bg-green-50", color: "text-green-600", sign: "+" },
  out:        { label: "Stock Out",  bg: "bg-red-50",   color: "text-red-500",   sign: "−" },
  adjustment: { label: "Adjustment", bg: "bg-amber-50", color: "text-amber-600", sign: "→" },
  return:     { label: "Return",     bg: "bg-blue-50",  color: "text-blue-600",  sign: "+" },
}

function MovementIcon({ type }) {
  const cfg = TYPE_CFG[type] || TYPE_CFG.adjustment
  return (
    <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${cfg.bg} ${cfg.color} text-sm font-bold`}>
      {cfg.sign}
    </span>
  )
}

// ─── Manual Add Movement Modal ──────────────────────────────────────────────────

function AddMovementModal({ products, onClose, onSave, saving }) {
  const [form, setForm] = useState({ product: "", movement_type: "in", quantity: 1, note: "" })
  const [err, setErr] = useState("")

  const handle = e => { setForm(p => ({ ...p, [e.target.name]: e.target.value })); setErr("") }

  const submit = () => {
    if (!form.product) { setErr("Please select a product."); return }
    if (!form.quantity || form.quantity < 1) { setErr("Quantity must be at least 1."); return }
    onSave(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <p className="text-base font-semibold text-gray-900">Add Stock Movement</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
        </div>

        <div className="px-6 py-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Product *</label>
            <select name="product" value={form.product} onChange={handle}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
              <option value="">Select product…</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock_quantity})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Movement Type *</label>
            <select name="movement_type" value={form.movement_type} onChange={handle}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
              <option value="in">Stock In (received new stock)</option>
              <option value="out">Stock Out (manual deduction)</option>
              <option value="adjustment">Adjustment (set exact count)</option>
              <option value="return">Return (customer returned)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              {form.movement_type === "adjustment" ? "New Stock Count *" : "Quantity *"}
            </label>
            <input name="quantity" type="number" min="0" value={form.quantity} onChange={handle}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Note (optional)</label>
            <input name="note" value={form.note} onChange={handle}
              placeholder="e.g. Received from supplier"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>

          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button onClick={onClose} disabled={saving}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={submit} disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving…" : "Add Movement"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-gray-100" />)}
    </div>
  )
}

// ─── Main StockHistoryPage ─────────────────────────────────────────────────────

const TYPE_FILTERS = [
  { key: "", label: "All" },
  { key: "in", label: "Stock In" },
  { key: "out", label: "Stock Out" },
  { key: "adjustment", label: "Adjustment" },
  { key: "return", label: "Return" },
]

export default function StockHistoryPage() {
  const navigate = useNavigate()
  const [movements, setMovements] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState("")
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState({ count: 0, total_pages: 1 })
  const [addModal, setAddModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState("")

  const fetchMovements = (currentPage = 1) => {
    setLoading(true)
    inventoryAPI.getStockMovements({ movementType: typeFilter || null, page: currentPage, pageSize: 50 })
      .then(res => {
        setMovements(res.data.results || [])
        setMeta({ count: res.data.count, total_pages: res.data.total_pages })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    inventoryAPI.getProducts().then(res => setProducts(res.data)).catch(console.error)
  }, [])

  useEffect(() => { setPage(1); fetchMovements(1) }, [typeFilter])

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(""), 3000) }

  const handleAddMovement = async (form) => {
    setSaving(true)
    try {
      await inventoryAPI.addStockMovement(form)
      showToast("Stock movement recorded ✓")
      fetchMovements(page)
      setAddModal(false)
    } catch (err) {
      showToast(err?.response?.data?.error || "Failed to add movement.")
    } finally { setSaving(false) }
  }

  return (
    <Layout>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button onClick={() => navigate("/products")}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition">
          ← Back
        </button>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-gray-900">Stock History</h2>
          <p className="text-xs text-gray-400 mt-0.5">{meta.count} movements recorded</p>
        </div>
        <button onClick={() => setAddModal(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition">
          + Add Movement
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-1.5 flex-wrap">
        {TYPE_FILTERS.map(f => (
          <button key={f.key} onClick={() => setTypeFilter(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              typeFilter === f.key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <Skeleton />
      ) : movements.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-sm font-medium text-gray-900 mb-1">No stock movements yet</p>
          <p className="text-xs text-gray-400">
            Movements appear here automatically when invoices are created, or add one manually.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
            {movements.map(m => {
              const cfg = TYPE_CFG[m.movement_type] || TYPE_CFG.adjustment
              return (
                <div key={m.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/60 transition">
                  <MovementIcon type={m.movement_type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {cfg.label} — {m.product_name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {m.note || "No note"} · {m.user_email}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold ${cfg.color}`}>
                      {cfg.sign}{m.quantity}
                    </p>
                    <p className="text-xs text-gray-400">{timeAgo(m.created_at)}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {meta.total_pages > 1 && (
            <div className="flex items-center justify-between pt-3">
              <button onClick={() => { const p = page - 1; setPage(p); fetchMovements(p) }}
                disabled={page === 1}
                className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition">
                ← Previous
              </button>
              <span className="text-xs text-gray-500">Page {page} of {meta.total_pages}</span>
              <button onClick={() => { const p = page + 1; setPage(p); fetchMovements(p) }}
                disabled={page === meta.total_pages}
                className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition">
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {addModal && (
        <AddMovementModal
          products={products}
          onClose={() => setAddModal(false)}
          onSave={handleAddMovement}
          saving={saving}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </Layout>
  )
}