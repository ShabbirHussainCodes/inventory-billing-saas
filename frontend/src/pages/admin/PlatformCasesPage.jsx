import { useState, useEffect } from "react"
import { superAdminAPI } from "../../services/api"

// ─── Platform Cases (Phase B.6 Stage E) ────────────────────────────────────
//
// Deliberately separate from the routine Founder-support actions in
// WorkspaceTeam.jsx (Stage C) — this page is for EXCEPTIONAL / adversarial
// situations: fraud, legal requests, ownership disputes, account recovery,
// emergency intervention. A case documents itself the moment it's opened
// (reason + identity verification), can sit open while things get sorted
// out off-platform, and only executes its actual system action when
// closed with resolution_notes. Nothing here is ever visible to the
// affected business — it's Founder-only, like the Audit Log.

function timeAgo(isoString) {
  if (!isoString) return ""
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

const CASE_TYPES = [
  { value: "forced_ownership_transfer", label: "Forced Ownership Transfer",
    description: "Force a Primary Owner handoff for a disputed/adversarial situation (current Primary unreachable, ownership dispute, etc.)." },
  { value: "account_recovery", label: "Account Recovery",
    description: "Reset a locked-out user's password after verifying their identity — same underlying action as the old unaudited reset-password tool, now with a full case trail." },
]

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
      status === "open" ? "bg-amber-50 text-amber-600" : "bg-gray-100 text-gray-500"
    }`}>
      {status === "open" ? "Open" : "Closed"}
    </span>
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

// ─── New Case Modal ─────────────────────────────────────────────────────────

function NewCaseModal({ onClose, onCreated }) {
  const [step, setStep] = useState(1) // 1: tenant, 2: type+target+reason
  const [tenants, setTenants] = useState([])
  const [tenantSearch, setTenantSearch] = useState("")
  const [tenant, setTenant] = useState(null)
  const [members, setMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(false)

  const [caseType, setCaseType] = useState("forced_ownership_transfer")
  const [targetMembershipId, setTargetMembershipId] = useState("")
  const [targetUserId, setTargetUserId] = useState("")
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")

  useEffect(() => {
    superAdminAPI.getTenants().then(res => {
      setTenants(res.data.results || res.data || [])
    }).catch(() => {})
  }, [])

  const pickTenant = async (t) => {
    setTenant(t)
    setMembersLoading(true)
    setTargetMembershipId("")
    setTargetUserId("")
    try {
      const res = await superAdminAPI.getTenantMembersForCase(t.id)
      setMembers(res.data)
    } catch {
      setMembers([])
    } finally {
      setMembersLoading(false)
    }
    setStep(2)
  }

  const filteredTenants = tenants.filter(t =>
    !tenantSearch.trim() ||
    t.name?.toLowerCase().includes(tenantSearch.toLowerCase()) ||
    t.subdomain?.toLowerCase().includes(tenantSearch.toLowerCase())
  )

  const eligibleTargets = caseType === "forced_ownership_transfer"
    ? members.filter(m => m.role_name === "Owner" && !m.is_primary_owner)
    : members

  const submit = async () => {
    if (caseType === "forced_ownership_transfer" && !targetMembershipId) {
      setErr("Select which Owner should become Primary Owner."); return
    }
    if (caseType === "account_recovery" && !targetUserId) {
      setErr("Select which member needs account recovery."); return
    }
    if (!reason.trim() || !notes.trim()) {
      setErr("Reason and identity verification notes are required."); return
    }
    setSaving(true)
    setErr("")
    try {
      const payload = {
        case_type: caseType,
        tenant_id: tenant.id,
        reason: reason.trim(),
        identity_verification_notes: notes.trim(),
      }
      if (caseType === "forced_ownership_transfer") payload.target_membership_id = targetMembershipId
      if (caseType === "account_recovery") payload.target_user_id = targetUserId
      await superAdminAPI.createPlatformCase(payload)
      onCreated()
    } catch (e) {
      setErr(e?.response?.data?.error || "Failed to create case.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <p className="text-base font-semibold text-gray-900">Open Platform Case</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
        </div>

        {step === 1 && (
          <div className="px-6 py-4 space-y-3">
            <p className="text-xs text-gray-400">Which business is this case about?</p>
            <input value={tenantSearch} onChange={e => setTenantSearch(e.target.value)}
              placeholder="Search business name or subdomain…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-100 divide-y divide-gray-50">
              {filteredTenants.length === 0 ? (
                <p className="px-3 py-4 text-xs text-gray-400 text-center">No businesses match.</p>
              ) : filteredTenants.map(t => (
                <button key={t.id} onClick={() => pickTenant(t)}
                  className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition">
                  <p className="text-sm font-medium text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.subdomain}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && tenant && (
          <div className="px-6 py-4 space-y-4">
            <div className="rounded-lg bg-gray-50 px-3 py-2 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Business</p>
                <p className="text-sm font-medium text-gray-900">{tenant.name}</p>
              </div>
              <button onClick={() => { setStep(1); setTenant(null) }} className="text-xs text-blue-600 hover:underline">
                Change
              </button>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Case Type *</label>
              <div className="space-y-2">
                {CASE_TYPES.map(ct => (
                  <label key={ct.value}
                    className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 cursor-pointer transition ${
                      caseType === ct.value ? "border-blue-300 bg-blue-50/50" : "border-gray-200 hover:bg-gray-50"
                    }`}>
                    <input type="radio" name="case_type" checked={caseType === ct.value}
                      onChange={() => { setCaseType(ct.value); setTargetMembershipId(""); setTargetUserId("") }}
                      className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{ct.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{ct.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {caseType === "forced_ownership_transfer" ? "Who should become Primary Owner? *" : "Which member needs recovery? *"}
              </label>
              {membersLoading ? (
                <p className="text-xs text-gray-400">Loading members…</p>
              ) : eligibleTargets.length === 0 ? (
                <p className="text-xs text-gray-400">
                  {caseType === "forced_ownership_transfer"
                    ? "No other active Owner found in this business."
                    : "No active members found in this business."}
                </p>
              ) : (
                <select
                  value={caseType === "forced_ownership_transfer" ? targetMembershipId : targetUserId}
                  onChange={e => caseType === "forced_ownership_transfer"
                    ? setTargetMembershipId(e.target.value)
                    : setTargetUserId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                  <option value="">Select…</option>
                  {eligibleTargets.map(m => (
                    <option key={m.membership_id} value={caseType === "forced_ownership_transfer" ? m.membership_id : m.user_id}>
                      {m.name ? `${m.name} — ` : ""}{m.email} ({m.role_name})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Reason *</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
                placeholder="Why is this case being opened?"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Identity verification notes *</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="How was the requester's identity/authority confirmed?"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>

            {err && <p className="text-xs text-red-500">{err}</p>}
          </div>
        )}

        {step === 2 && (
          <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
            <button onClick={onClose} disabled={saving}
              className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
              Cancel
            </button>
            <button onClick={submit} disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Opening…" : "Open Case"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Close Case Modal ───────────────────────────────────────────────────────

function CloseCaseModal({ caseItem, onClose, onClosed }) {
  const [resolutionNotes, setResolutionNotes] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")

  const submit = async () => {
    if (!resolutionNotes.trim()) { setErr("Resolution notes are required."); return }
    if (caseItem.case_type === "account_recovery" && (!newPassword || newPassword.length < 8)) {
      setErr("A new password (8+ characters) is required to execute this case."); return
    }
    setSaving(true)
    setErr("")
    try {
      const payload = { resolution_notes: resolutionNotes.trim() }
      if (caseItem.case_type === "account_recovery") payload.new_password = newPassword
      await superAdminAPI.closePlatformCase(caseItem.id, payload)
      onClosed()
    } catch (e) {
      setErr(e?.response?.data?.error || "Failed to close case.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <p className="text-base font-semibold text-gray-900">Close Case & Execute</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
        </div>
        <div className="px-6 py-4 space-y-3">
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            Closing this case will immediately{" "}
            {caseItem.case_type === "forced_ownership_transfer"
              ? `transfer Primary Owner to ${caseItem.target_membership_name}.`
              : `reset the password for ${caseItem.target_user_email}.`}
            {" "}This cannot be undone from here.
          </p>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Resolution notes *</label>
            <textarea value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} rows={3}
              placeholder="What was decided, and why?"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          {caseItem.case_type === "account_recovery" && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">New password *</label>
              <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          )}
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button onClick={onClose} disabled={saving}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={submit} disabled={saving}
            className="rounded-lg bg-red-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50">
            {saving ? "Executing…" : "Close & Execute"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Case Row ───────────────────────────────────────────────────────────────

function CaseRow({ caseItem, onCloseCase }) {
  const [expanded, setExpanded] = useState(false)
  const typeLabel = CASE_TYPES.find(t => t.value === caseItem.case_type)?.label || caseItem.case_type

  return (
    <div className="px-5 py-3.5">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-900">{typeLabel}</p>
            <StatusBadge status={caseItem.status} />
          </div>
          <p className="text-xs text-gray-400 mt-0.5 truncate">
            {caseItem.tenant_name} · {caseItem.target_membership_name || caseItem.target_user_email || "—"}
          </p>
        </div>
        <span className="flex-shrink-0 text-xs text-gray-400">{timeAgo(caseItem.created_at)}</span>
        {caseItem.status === "open" && (
          <button
            onClick={(e) => { e.stopPropagation(); onCloseCase(caseItem) }}
            className="flex-shrink-0 rounded-lg border border-red-100 px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 transition">
            Close & Execute
          </button>
        )}
      </div>
      {expanded && (
        <div className="mt-3 space-y-2 rounded-lg bg-gray-50 px-3 py-3 text-xs">
          <p><span className="text-gray-400">Opened by:</span> <span className="text-gray-700">{caseItem.created_by_email}</span></p>
          <p><span className="text-gray-400">Reason:</span> <span className="text-gray-700">{caseItem.reason}</span></p>
          <p><span className="text-gray-400">Identity verification:</span> <span className="text-gray-700">{caseItem.identity_verification_notes}</span></p>
          {caseItem.status === "closed" && (
            <>
              <p><span className="text-gray-400">Executed by:</span> <span className="text-gray-700">{caseItem.executed_by_email}</span></p>
              <p><span className="text-gray-400">Resolution:</span> <span className="text-gray-700">{caseItem.resolution_notes}</span></p>
              <p><span className="text-gray-400">Closed:</span> <span className="text-gray-700">{timeAgo(caseItem.closed_at)}</span></p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function CasesSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="px-5 py-4 animate-pulse space-y-2">
          <div className="h-3.5 w-48 rounded bg-gray-100" />
          <div className="h-3 w-32 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { key: "", label: "All" },
  { key: "open", label: "Open" },
  { key: "closed", label: "Closed" },
]

export default function PlatformCasesPage() {
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [showNewCase, setShowNewCase] = useState(false)
  const [closeTarget, setCloseTarget] = useState(null)
  const [toast, setToast] = useState("")

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(""), 3000) }

  const fetchCases = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await superAdminAPI.getPlatformCases({ status: statusFilter || null })
      setCases(res.data)
    } catch (e) {
      setError(e?.response?.data?.error || "Could not load Platform Cases.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCases() }, [statusFilter])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="text-base font-semibold text-gray-900">Platform Cases</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Exceptional / adversarial situations only — fraud, disputes, account recovery.
            Fully separate from routine team actions, and never visible to the business.
          </p>
        </div>
        <button onClick={() => setShowNewCase(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition">
          + Open Case
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              statusFilter === f.key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <CasesSkeleton />
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <button onClick={fetchCases} className="rounded-lg border border-red-200 bg-white px-4 py-1.5 text-sm text-red-600 hover:bg-red-50">
            Try again
          </button>
        </div>
      ) : cases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-sm font-medium text-gray-900 mb-1">No cases found</p>
          <p className="text-xs text-gray-400">Cases only exist for genuinely exceptional situations.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
          {cases.map(c => (
            <CaseRow key={c.id} caseItem={c} onCloseCase={setCloseTarget} />
          ))}
        </div>
      )}

      {showNewCase && (
        <NewCaseModal
          onClose={() => setShowNewCase(false)}
          onCreated={() => { setShowNewCase(false); showToast("Case opened."); fetchCases() }}
        />
      )}
      {closeTarget && (
        <CloseCaseModal
          caseItem={closeTarget}
          onClose={() => setCloseTarget(null)}
          onClosed={() => { setCloseTarget(null); showToast("Case closed and executed."); fetchCases() }}
        />
      )}
      <Toast message={toast} />
    </div>
  )
}
