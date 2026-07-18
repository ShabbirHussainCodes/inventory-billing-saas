import { useState, useEffect } from "react"
import { teamAPI } from "../services/api"

// ─── Phase C — Custom Roles + Permission Editor ────────────────────────────
//
// Separate panel from the member list in TeamPage.jsx — this manages the
// ROLE CATALOG itself (create/edit/delete custom roles + pick their
// permissions), not who has which role. Gated on role.manage_custom
// (Owner-only by default, see teams/roles.py) rather than the broader
// team.manage that Manager also has — designing new roles is a bigger
// decision than day-to-day people management.

function Toast({ message }) {
  if (!message) return null
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">
      {message}
    </div>
  )
}

// ─── Permission checkbox editor, grouped by category ───────────────────────

function PermissionEditor({ catalog, selected, onChange }) {
  const byCategory = {}
  for (const p of catalog) {
    if (!byCategory[p.category]) byCategory[p.category] = []
    byCategory[p.category].push(p)
  }

  const toggle = (codename) => {
    onChange(selected.includes(codename) ? selected.filter(c => c !== codename) : [...selected, codename])
  }

  const toggleCategory = (perms) => {
    const codenames = perms.map(p => p.codename)
    const allSelected = codenames.every(c => selected.includes(c))
    onChange(allSelected
      ? selected.filter(c => !codenames.includes(c))
      : [...new Set([...selected, ...codenames])])
  }

  return (
    <div className="space-y-3 max-h-80 overflow-y-auto rounded-lg border border-gray-100 p-3">
      {Object.entries(byCategory).map(([category, perms]) => {
        const allSelected = perms.every(p => selected.includes(p.codename))
        return (
          <div key={category}>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{category}</p>
              <button type="button" onClick={() => toggleCategory(perms)}
                className="text-[11px] text-blue-600 hover:underline">
                {allSelected ? "Clear all" : "Select all"}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {perms.map(p => (
                <label key={p.codename} className="flex items-start gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={selected.includes(p.codename)}
                    onChange={() => toggle(p.codename)} className="mt-0.5" />
                  <span className="text-gray-700">{p.label}</span>
                </label>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Create/Edit Role Modal ─────────────────────────────────────────────────

function RoleFormModal({ role, onClose, onSaved }) {
  const isEdit = !!role
  const [catalog, setCatalog] = useState([])
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [name, setName] = useState(role?.name || "")
  const [description, setDescription] = useState(role?.description || "")
  const [selected, setSelected] = useState(role?.permission_codenames || [])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")

  useEffect(() => {
    teamAPI.getPermissionCatalog()
      .then(res => setCatalog(res.data))
      .catch(e => setErr(e?.response?.data?.error || "Could not load permission catalog."))
      .finally(() => setLoadingCatalog(false))
  }, [])

  const submit = async () => {
    if (!name.trim()) { setErr("Role name is required."); return }
    if (selected.length === 0) { setErr("Select at least one permission."); return }
    setSaving(true)
    setErr("")
    try {
      if (isEdit) {
        await teamAPI.updateRole(role.id, { name: name.trim(), description: description.trim(), permission_codenames: selected })
      } else {
        await teamAPI.createRole({ name: name.trim(), description: description.trim(), permission_codenames: selected })
      }
      onSaved()
    } catch (e) {
      setErr(e?.response?.data?.error || "Failed to save role.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <p className="text-base font-semibold text-gray-900">{isEdit ? `Edit "${role.name}"` : "New Custom Role"}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Role name *</label>
            <input value={name} onChange={e => { setName(e.target.value); setErr("") }}
              placeholder="e.g. Cashier"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Optional — what is this role for?"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Permissions * <span className="text-gray-400">({selected.length} selected)</span>
            </label>
            {loadingCatalog ? (
              <p className="text-xs text-gray-400">Loading permissions…</p>
            ) : (
              <PermissionEditor catalog={catalog} selected={selected} onChange={setSelected} />
            )}
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button onClick={onClose} disabled={saving}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={submit} disabled={saving || loadingCatalog}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Role"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete confirm ─────────────────────────────────────────────────────────

function DeleteRoleConfirm({ role, onConfirm, onCancel, loading }) {
  if (!role) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <p className="text-base font-semibold text-gray-900">Delete "{role.name}"?</p>
        <p className="mt-1.5 text-sm text-gray-500">
          This can't be undone. If any team member still has this role, deletion will be blocked
          until you reassign them.
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

// ─── Main panel ─────────────────────────────────────────────────────────────

export default function RolesManager({ roles, onClose, onRolesChanged }) {
  const [formTarget, setFormTarget] = useState(undefined) // undefined = closed, null = create, role obj = edit
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState("")

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(""), 3000) }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await teamAPI.deleteRole(deleteTarget.id)
      showToast("Role deleted.")
      setDeleteTarget(null)
      onRolesChanged()
    } catch (e) {
      showToast(e?.response?.data?.error || "Failed to delete role.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <p className="text-base font-semibold text-gray-900">Manage Roles</p>
            <p className="text-xs text-gray-400 mt-0.5">System roles are fixed. Custom roles are yours to define.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
        </div>

        <div className="px-6 py-4 space-y-2">
          <div className="flex justify-end mb-2">
            <button onClick={() => setFormTarget(null)}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition">
              + New Custom Role
            </button>
          </div>

          <div className="rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            {roles.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{r.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      r.is_system_role ? "bg-gray-100 text-gray-500" : "bg-blue-50 text-blue-600"
                    }`}>
                      {r.is_system_role ? "System" : "Custom"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {r.description || "No description"} · {r.permission_codenames.length} permission{r.permission_codenames.length === 1 ? "" : "s"}
                  </p>
                </div>
                {!r.is_system_role && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setFormTarget(r)}
                      className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 transition">
                      Edit
                    </button>
                    <button onClick={() => setDeleteTarget(r)}
                      className="rounded-lg border border-red-100 px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 transition">
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {formTarget !== undefined && (
        <RoleFormModal role={formTarget} onClose={() => setFormTarget(undefined)}
          onSaved={() => { setFormTarget(undefined); showToast(formTarget ? "Role updated." : "Role created."); onRolesChanged() }} />
      )}
      <DeleteRoleConfirm role={deleteTarget} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
      <Toast message={toast} />
    </div>
  )
}
