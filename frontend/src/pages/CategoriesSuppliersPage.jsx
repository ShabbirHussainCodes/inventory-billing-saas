import { useState, useEffect } from "react"
import Layout from "../components/Layout"
import { inventoryAPI } from "../services/api"

// ─── Generic Modal (Category + Supplier dono ke liye reuse) ──────────────────

function CategoryModal({ item, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    name: item?.name || "",
    description: item?.description || "",
  })
  const [err, setErr] = useState("")

  const handle = e => { setForm(p => ({ ...p, [e.target.name]: e.target.value })); setErr("") }

  const submit = () => {
    if (!form.name.trim()) { setErr("Category name is required."); return }
    onSave(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <p className="text-base font-semibold text-gray-900">
            {item ? "Edit Category" : "Add Category"}
          </p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Category Name *</label>
            <input name="name" value={form.name} onChange={handle}
              placeholder="e.g. Electronics"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Description (optional)</label>
            <textarea name="description" value={form.description} onChange={handle} rows={2}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
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
            {saving ? "Saving…" : item ? "Save Changes" : "Add Category"}
          </button>
        </div>
      </div>
    </div>
  )
}

function SupplierModal({ item, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    name: item?.name || "",
    email: item?.email || "",
    phone: item?.phone || "",
    address: item?.address || "",
    country: item?.country || "",
  })
  const [err, setErr] = useState("")

  const handle = e => { setForm(p => ({ ...p, [e.target.name]: e.target.value })); setErr("") }

  const submit = () => {
    if (!form.name.trim()) { setErr("Supplier name is required."); return }
    onSave(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <p className="text-base font-semibold text-gray-900">
            {item ? "Edit Supplier" : "Add Supplier"}
          </p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Supplier Name *</label>
            <input name="name" value={form.name} onChange={handle}
              placeholder="e.g. Mehta Distributors"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input name="email" type="email" value={form.email} onChange={handle}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Phone</label>
              <input name="phone" value={form.phone} onChange={handle}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Country</label>
              <input name="country" value={form.country} onChange={handle}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Address</label>
              <input name="address" value={form.address} onChange={handle}
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
            {saving ? "Saving…" : item ? "Save Changes" : "Add Supplier"}
          </button>
        </div>
      </div>
    </div>
  )
}

function DeleteConfirm({ item, label, onConfirm, onCancel, loading }) {
  if (!item) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <p className="text-base font-semibold text-gray-900">Delete {label}?</p>
        <p className="mt-1.5 text-sm text-gray-500">
          "<strong className="text-gray-800">{item.name}</strong>" will be removed.
          Products linked to it will keep working, just unassigned.
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

function Toast({ message }) {
  if (!message) return null
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">
      {message}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-gray-100" />)}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CategoriesSuppliersPage() {
  const [tab, setTab] = useState("categories") // 'categories' | 'suppliers'

  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)

  const [addModal, setAddModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteItem, setDeleteItem] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState("")

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [catRes, supRes] = await Promise.all([
        inventoryAPI.getCategories(),
        inventoryAPI.getSuppliers(),
      ])
      setCategories(catRes.data)
      setSuppliers(supRes.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(""), 3000) }

  const isCategory = tab === "categories"
  const items = isCategory ? categories : suppliers
  const label = isCategory ? "category" : "supplier"

  const handleAdd = async (form) => {
    setSaving(true)
    try {
      if (isCategory) await inventoryAPI.addCategory(form)
      else await inventoryAPI.addSupplier(form)
      showToast(`${isCategory ? "Category" : "Supplier"} added ✓`)
      fetchAll()
      setAddModal(false)
    } catch {
      showToast(`Failed to add ${label}.`)
    } finally { setSaving(false) }
  }

  const handleEdit = async (form) => {
    setSaving(true)
    try {
      if (isCategory) await inventoryAPI.updateCategory(editItem.id, form)
      else await inventoryAPI.updateSupplier(editItem.id, form)
      showToast(`${isCategory ? "Category" : "Supplier"} updated ✓`)
      fetchAll()
      setEditItem(null)
    } catch {
      showToast(`Failed to update ${label}.`)
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      if (isCategory) await inventoryAPI.deleteCategory(deleteItem.id)
      else await inventoryAPI.deleteSupplier(deleteItem.id)
      showToast(`${isCategory ? "Category" : "Supplier"} deleted ✓`)
      fetchAll()
      setDeleteItem(null)
    } catch {
      showToast(`Failed to delete ${label}.`)
    } finally { setSaving(false) }
  }

  return (
    <Layout>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="text-base font-semibold text-gray-900">Categories & Suppliers</h2>
          <p className="text-xs text-gray-400 mt-0.5">Organize your inventory</p>
        </div>
        <button onClick={() => setAddModal(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition">
          + Add {isCategory ? "Category" : "Supplier"}
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1.5">
        <button onClick={() => setTab("categories")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            tab === "categories" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}>
          Categories ({categories.length})
        </button>
        <button onClick={() => setTab("suppliers")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            tab === "suppliers" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}>
          Suppliers ({suppliers.length})
        </button>
      </div>

      {/* List */}
      {loading ? (
        <Skeleton />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-sm font-medium text-gray-900 mb-1">No {label}s yet</p>
          <button onClick={() => setAddModal(true)} className="mt-2 text-sm text-blue-600 hover:underline">
            Add your first {label} →
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/60 transition">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600">
                {item.name?.[0]?.toUpperCase() || "?"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isCategory
                    ? (item.description || "No description")
                    : [item.email, item.phone, item.country].filter(Boolean).join(" · ") || "No contact info"}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => setEditItem(item)}
                  className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 transition">
                  Edit
                </button>
                <button onClick={() => setDeleteItem(item)}
                  className="rounded-lg border border-red-100 px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 transition">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {addModal && isCategory && (
        <CategoryModal onClose={() => setAddModal(false)} onSave={handleAdd} saving={saving} />
      )}
      {addModal && !isCategory && (
        <SupplierModal onClose={() => setAddModal(false)} onSave={handleAdd} saving={saving} />
      )}
      {editItem && isCategory && (
        <CategoryModal item={editItem} onClose={() => setEditItem(null)} onSave={handleEdit} saving={saving} />
      )}
      {editItem && !isCategory && (
        <SupplierModal item={editItem} onClose={() => setEditItem(null)} onSave={handleEdit} saving={saving} />
      )}
      <DeleteConfirm item={deleteItem} label={label} onConfirm={handleDelete} onCancel={() => setDeleteItem(null)} loading={saving} />
      <Toast message={toast} />
    </Layout>
  )
}