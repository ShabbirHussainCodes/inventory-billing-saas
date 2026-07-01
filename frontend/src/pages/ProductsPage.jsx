import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import Layout from "../components/Layout"
import { inventoryAPI, isPlanLimitError, getPlanLimitMessage } from "../services/api"

// ─── Product Modal (Add + Edit) ───────────────────────────────────────────────

function ProductModal({ product, categories, suppliers, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    name: product?.name || "",
    sku: product?.sku || "",
    barcode: product?.barcode || "",
    category: product?.category || "",
    supplier: product?.supplier || "",
    cost_price: product?.cost_price || "",
    selling_price: product?.selling_price || "",
    stock_quantity: product?.stock_quantity ?? 0,
    reorder_point: product?.reorder_point ?? 10,
    tax_rate: product?.tax_rate ?? 0,
  })
  const [err, setErr] = useState("")

  const handle = e => { setForm(p => ({ ...p, [e.target.name]: e.target.value })); setErr("") }

  const submit = () => {
    if (!form.name || !form.sku || !form.cost_price || !form.selling_price) {
      setErr("Name, SKU, Cost Price and Selling Price are required.")
      return
    }
    // Empty dropdown selection ko null bhejo, empty string nahi
    onSave({
      ...form,
      category: form.category || null,
      supplier: form.supplier || null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <p className="text-base font-semibold text-gray-900">
            {product ? "Edit Product" : "Add Product"}
          </p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
        </div>

        <div className="px-6 py-4 space-y-3">
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
                placeholder="RICE-001"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <select name="category" value={form.category} onChange={handle}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white">
                <option value="">No category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Supplier</label>
              <select name="supplier" value={form.supplier} onChange={handle}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white">
                <option value="">No supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Barcode (optional)</label>
            <input name="barcode" value={form.barcode} onChange={handle}
              placeholder="Scan or type barcode"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
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
              <label className="block text-xs text-gray-500 mb-1">Reorder At</label>
              <input name="reorder_point" type="number" value={form.reorder_point} onChange={handle}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tax Rate %</label>
              <input name="tax_rate" type="number" step="0.01" value={form.tax_rate} onChange={handle}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
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
            {saving ? "Saving…" : product ? "Save Changes" : "Add Product"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete Confirm ────────────────────────────────────────────────────────────

function DeleteConfirm({ product, onConfirm, onCancel, loading }) {
  if (!product) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <p className="text-base font-semibold text-gray-900">Delete product?</p>
        <p className="mt-1.5 text-sm text-gray-500">
          "<strong className="text-gray-800">{product.name}</strong>" will be permanently removed from inventory.
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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-gray-100" />)}
    </div>
  )
}

// ─── Main ProductsPage ─────────────────────────────────────────────────────────

export default function ProductsPage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [addModal, setAddModal] = useState(false)
  const [editModal, setEditModal] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState("")

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const res = await inventoryAPI.getProducts()
      setProducts(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
    inventoryAPI.getCategories().then(res => setCategories(res.data)).catch(console.error)
    inventoryAPI.getSuppliers().then(res => setSuppliers(res.data)).catch(console.error)
  }, [])

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(""), 3000) }

  const handleAdd = async (form) => {
    setSaving(true)
    try {
      await inventoryAPI.addProduct(form)
      showToast("Product added ✓")
      fetchProducts()
      setAddModal(false)
    } catch(err) {
      if (isPlanLimitError(err)) showToast(getPlanLimitMessage(err))
      else showToast("Failed to add product.")
    } finally { setSaving(false) }
  }

  const handleEdit = async (form) => {
    setSaving(true)
    try {
      await inventoryAPI.updateProduct(editModal.id, form)
      showToast("Product updated ✓")
      fetchProducts()
      setEditModal(null)
    } catch {
      showToast("Failed to update product.")
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      await inventoryAPI.deleteProduct(deleteConfirm.id)
      showToast("Product deleted ✓")
      fetchProducts()
      setDeleteConfirm(null)
    } catch {
      showToast("Failed to delete product.")
    } finally { setSaving(false) }
  }

  const filtered = products.filter(p => {
    const q = search.toLowerCase()
    return !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
  })

  const lowStockCount = products.filter(p => p.is_low_stock).length

  return (
    <Layout>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="text-base font-semibold text-gray-900">Products</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {products.length} products
            {lowStockCount > 0 && <> · <span className="text-amber-600">{lowStockCount} low stock</span></>}
          </p>
        </div>
        <button onClick={() => navigate("/stock-history")}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
          Stock History →
        </button>
        <button onClick={() => setAddModal(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition">
          + Add Product
        </button>
      </div>

      {/* Search */}
      <div className="mb-4 relative max-w-sm">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input type="text" placeholder="Search products…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
      </div>

      {/* Table */}
      {loading ? (
        <Skeleton />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-sm font-medium text-gray-900 mb-1">
            {search ? "No products match your search" : "No products yet"}
          </p>
          {!search && (
            <button onClick={() => setAddModal(true)} className="mt-2 text-sm text-blue-600 hover:underline">
              Add your first product →
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-2xl border border-gray-200 bg-white overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400">
                  <th className="px-4 py-3 text-left font-medium">Product</th>
                  <th className="px-4 py-3 text-left font-medium">Category</th>
                  <th className="px-4 py-3 text-left font-medium">SKU</th>
                  <th className="px-4 py-3 text-left font-medium">Cost</th>
                  <th className="px-4 py-3 text-left font-medium">Selling</th>
                  <th className="px-4 py-3 text-left font-medium">Margin</th>
                  <th className="px-4 py-3 text-left font-medium">Stock</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50/60 transition">
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-gray-900">{p.name}</p>
                      {p.is_low_stock && <p className="text-[11px] text-amber-600 mt-0.5">⚠ Low stock</p>}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-500">
                      {p.category_name || <span className="text-gray-300">—</span>}
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
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setEditModal(p)}
                          className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 transition">
                          Edit
                        </button>
                        <button onClick={() => setDeleteConfirm(p)}
                          className="rounded-lg border border-red-100 px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 transition">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map(p => (
              <div key={p.id} className={`rounded-2xl border bg-white p-4 ${p.is_low_stock ? 'border-amber-200' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs font-mono text-gray-400">{p.sku}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.is_low_stock ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                    Stock: {p.stock_quantity}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
                  <div>
                    <p className="text-gray-400">Cost</p>
                    <p className="font-medium text-gray-700">₹{p.cost_price}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Selling</p>
                    <p className="font-medium text-gray-700">₹{p.selling_price}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Margin</p>
                    <p className="font-medium text-green-600">{p.profit_margin}%</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditModal(p)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
                    Edit
                  </button>
                  <button onClick={() => setDeleteConfirm(p)}
                    className="rounded-lg border border-red-100 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {addModal && <ProductModal categories={categories} suppliers={suppliers} onClose={() => setAddModal(false)} onSave={handleAdd} saving={saving} />}
      {editModal && <ProductModal product={editModal} categories={categories} suppliers={suppliers} onClose={() => setEditModal(null)} onSave={handleEdit} saving={saving} />}
      <DeleteConfirm product={deleteConfirm} onConfirm={handleDelete} onCancel={() => setDeleteConfirm(null)} loading={saving} />
      <Toast message={toast} />
    </Layout>
  )
}