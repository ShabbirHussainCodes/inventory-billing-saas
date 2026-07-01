import { useState, useEffect } from "react"
import { inventoryAPI } from "../../services/api"

// ─── Product Form Modal (Add + Edit dono ke liye) ────────────────────────────

function ProductModal({ product, onClose, onSave, loading }) {
  const [form, setForm] = useState({
    name: product?.name || "",
    sku: product?.sku || "",
    cost_price: product?.cost_price || "",
    selling_price: product?.selling_price || "",
    stock_quantity: product?.stock_quantity ?? 0,
    reorder_point: product?.reorder_point ?? 10,
    tax_rate: product?.tax_rate ?? 0,
  })
  const [err, setErr] = useState("")

  const handle = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }))
    setErr("")
  }

  const handleSubmit = () => {
    if (!form.name || !form.sku || !form.cost_price || !form.selling_price) {
      setErr("Name, SKU, Cost Price aur Selling Price required hain.")
      return
    }
    onSave(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-base font-semibold text-gray-900 mb-4">
          {product ? "Edit Product" : "Add Product"}
        </h3>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Product Name *</label>
              <input name="name" value={form.name} onChange={handle}
                placeholder="e.g. Rice 1kg"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">SKU *</label>
              <input name="sku" value={form.sku} onChange={handle}
                placeholder="e.g. RICE-001"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cost Price *</label>
              <input name="cost_price" type="number" step="0.01" value={form.cost_price} onChange={handle}
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Selling Price *</label>
              <input name="selling_price" type="number" step="0.01" value={form.selling_price} onChange={handle}
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Stock Qty</label>
              <input name="stock_quantity" type="number" value={form.stock_quantity} onChange={handle}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Reorder Point</label>
              <input name="reorder_point" type="number" value={form.reorder_point} onChange={handle}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tax Rate %</label>
              <input name="tax_rate" type="number" step="0.01" value={form.tax_rate} onChange={handle}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>
        </div>

        {err && <p className="mt-2 text-xs text-red-500">{err}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} disabled={loading}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Saving…" : product ? "Save Changes" : "Add Product"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete Confirmation ──────────────────────────────────────────────────────

function DeleteConfirm({ product, onConfirm, onCancel, loading }) {
  if (!product) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">Delete product?</h3>
        <p className="mt-1.5 text-sm text-gray-500">
          "<strong className="text-gray-800">{product.name}</strong>" client ke
          inventory se permanently hata diya jaayega.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onCancel} disabled={loading}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="rounded-lg bg-red-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50">
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message }) {
  if (!message) return null
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">
      {message}
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function InventorySkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 rounded-xl bg-gray-100" />
      ))}
    </div>
  )
}

// ─── Main WorkspaceInventory ──────────────────────────────────────────────────

export default function WorkspaceInventory({ isEditMode }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [addModal, setAddModal] = useState(false)
  const [editModal, setEditModal] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [formLoading, setFormLoading] = useState(false)
  const [toast, setToast] = useState("")

  const fetchProducts = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await inventoryAPI.getProducts()
      setProducts(res.data)
    } catch (err) {
      setError(err?.response?.data?.error || "Could not load products.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProducts() }, [])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(""), 3000)
  }

  // ── CRUD handlers ──
  const handleAdd = async (form) => {
    setFormLoading(true)
    try {
      await inventoryAPI.addProduct(form)
      showToast("Product added ✓")
      fetchProducts()
      setAddModal(false)
    } catch {
      showToast("Failed to add product.")
    } finally {
      setFormLoading(false)
    }
  }

  const handleEdit = async (form) => {
    setFormLoading(true)
    try {
      await inventoryAPI.updateProduct(editModal.id, form)
      showToast("Product updated ✓")
      fetchProducts()
      setEditModal(null)
    } catch {
      showToast("Failed to update product.")
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async () => {
    setFormLoading(true)
    try {
      await inventoryAPI.deleteProduct(deleteConfirm.id)
      showToast("Product deleted ✓")
      fetchProducts()
      setDeleteConfirm(null)
    } catch {
      showToast("Failed to delete product.")
    } finally {
      setFormLoading(false)
    }
  }

  // Client-side filter
  const filtered = products.filter((p) => {
    const q = search.toLowerCase()
    return !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q)
  })

  const lowStockCount = products.filter((p) => p.is_low_stock).length

  if (loading) return <InventorySkeleton />

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-600 mb-1">Failed to load inventory</p>
        <p className="text-xs text-red-400 mb-3">{error}</p>
        <button onClick={fetchProducts}
          className="rounded-lg border border-red-200 bg-white px-4 py-1.5 text-sm text-red-600 hover:bg-red-50">
          Try again
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Inventory</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {products.length} products
            {lowStockCount > 0 && (
              <> · <span className="text-amber-600">{lowStockCount} low stock</span></>
            )}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          {/* Add button — sirf Edit Mode mein */}
          {isEditMode && (
            <button
              onClick={() => setAddModal(true)}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              + Add Product
            </button>
          )}
        </div>
      </div>

      {/* View mode notice */}
      {!isEditMode && (
        <div className="mb-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
          <p className="text-xs text-amber-700">
            👁 View Only — Switch to Edit Mode to add, edit, or delete products
          </p>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-x-auto">
        <table className="w-full border-collapse text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-gray-100 text-xs text-gray-400">
              <th className="px-4 py-3 text-left font-medium">Product</th>
              <th className="px-4 py-3 text-left font-medium">SKU</th>
              <th className="px-4 py-3 text-left font-medium">Cost</th>
              <th className="px-4 py-3 text-left font-medium">Selling</th>
              <th className="px-4 py-3 text-left font-medium">Margin</th>
              <th className="px-4 py-3 text-left font-medium">Stock</th>
              {isEditMode && (
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={isEditMode ? 7 : 6}
                  className="py-12 text-center text-sm text-gray-400">
                  {search
                    ? "No products match your search."
                    : "No products in inventory yet."}
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/60 transition">
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-gray-900">{p.name}</p>
                    {p.is_low_stock && (
                      <p className="text-[11px] text-amber-600 mt-0.5">⚠ Low stock</p>
                    )}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs text-gray-500">{p.sku}</td>
                  <td className="px-4 py-3.5 text-gray-700">{p.cost_price}</td>
                  <td className="px-4 py-3.5 text-gray-700">{p.selling_price}</td>
                  <td className="px-4 py-3.5">
                    <span className="text-green-600 font-medium">{p.profit_margin}%</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`font-medium ${p.is_low_stock ? "text-amber-600" : "text-gray-800"}`}>
                      {p.stock_quantity}
                    </span>
                    <span className="text-xs text-gray-400 ml-1">/ {p.reorder_point}</span>
                  </td>
                  {isEditMode && (
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditModal(p)}
                          className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(p)}
                          className="rounded-lg border border-red-100 px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 transition"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {addModal && (
        <ProductModal
          onClose={() => setAddModal(false)}
          onSave={handleAdd}
          loading={formLoading}
        />
      )}
      {editModal && (
        <ProductModal
          product={editModal}
          onClose={() => setEditModal(null)}
          onSave={handleEdit}
          loading={formLoading}
        />
      )}
      <DeleteConfirm
        product={deleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
        loading={formLoading}
      />

      <Toast message={toast} />
    </>
  )
}