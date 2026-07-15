import { useState, useEffect } from "react"
import { teamAPI } from "../../services/api"

// ─── Badges ───────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  active: "bg-green-50 text-green-600",
  invited: "bg-yellow-50 text-yellow-600",
  suspended: "bg-orange-50 text-orange-600",
  removed: "bg-gray-100 text-gray-500",
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] || "bg-gray-100 text-gray-500"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function SectionTitle({ children, sub }) {
  return (
    <div className="mb-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{children}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
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

// This whole component only ever renders inside the Founder's Support
// Workspace (see BusinessWorkspacePage.jsx) — a real business Owner never
// sees this screen, they have their own separate Team page. So every action
// taken here is, structurally, always a Founder action. That's why any
// action that touches an Owner-role membership (inviting one, suspending
// one, removing one, changing their role, handing off Primary Owner) always
// collects `reason` + `identity_verification_notes` here — this is Stage C:
// Founder gets full operational parity, but ownership-sensitive actions
// carry a mandatory accountability trail (dual-logged to this business's own
// Activity Log AND the Founder's platform Audit Log).

// ─── Ownership fields (shared by every Owner-touching modal) ─────────────

function OwnershipFields({ reason, setReason, notes, setNotes, err }) {
  return (
    <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-3 space-y-2">
      <p className="text-[11px] font-medium text-amber-700">
        Ownership action — reason and identity verification are required and will be logged.
      </p>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Reason *</label>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
          placeholder="Why is this being done on the customer's behalf?"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Identity verification notes *</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          placeholder="How was the requester's identity confirmed? (call, OTP, signed request, etc.)"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
      </div>
      {err && <p className="text-xs text-red-500">{err}</p>}
    </div>
  )
}

// ─── Invite Modal — Owner is offered, but requires ownership fields ──────

function InviteModal({ roles, onClose, onInvited }) {
  const [email, setEmail] = useState("")
  const [roleId, setRoleId] = useState(roles[0]?.id || "")
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")
  const [inviteLink, setInviteLink] = useState(null)

  const selectedRole = roles.find(r => r.id === roleId)
  const isOwnerRole = selectedRole?.name === 'Owner'

  const submit = async () => {
    if (!email.trim()) { setErr("Email is required."); return }
    if (!roleId) { setErr("Please select a role."); return }
    if (isOwnerRole && (!reason.trim() || !notes.trim())) {
      setErr("Reason and identity verification notes are required to invite an Owner.")
      return
    }
    setSaving(true)
    setErr("")
    try {
      const payload = { email: email.trim(), role_id: roleId }
      if (isOwnerRole) {
        payload.reason = reason.trim()
        payload.identity_verification_notes = notes.trim()
      }
      const res = await teamAPI.inviteMember(payload)
      setInviteLink(`${window.location.origin}/accept-invite/${res.data.invite_token}`)
      onInvited()
    } catch (e) {
      setErr(e?.response?.data?.error || "Failed to create invite.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <p className="text-base font-semibold text-gray-900">
            {inviteLink ? "Invite created" : "Invite a team member (as Founder support)"}
          </p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
        </div>

        {inviteLink ? (
          <div className="px-6 py-5 space-y-3">
            <p className="text-sm text-gray-600">
              Share this link with <strong>{email}</strong> on the customer's behalf. Valid 7 days.
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <input readOnly value={inviteLink}
                className="flex-1 min-w-0 truncate bg-transparent text-xs text-gray-700 focus:outline-none" />
              <button onClick={() => navigator.clipboard.writeText(inviteLink)}
                className="flex-shrink-0 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700">
                Copy
              </button>
            </div>
            <div className="flex justify-end pt-1">
              <button onClick={onClose} className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-800">
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email *</label>
                <input type="email" value={email} onChange={e => { setEmail(e.target.value); setErr("") }}
                  placeholder="staff@example.com"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Role *</label>
                <select value={roleId} onChange={e => { setRoleId(e.target.value); setErr("") }}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              {isOwnerRole && (
                <OwnershipFields reason={reason} setReason={setReason} notes={notes} setNotes={setNotes} err="" />
              )}
              {err && <p className="text-xs text-red-500">{err}</p>}
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button onClick={onClose} disabled={saving}
                className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
              <button onClick={submit} disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Creating…" : "Create Invite"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Change Role Modal — Owner offered both ways, ownership fields shown
//     whenever Owner is involved on either side of the change ────────────

function ChangeRoleModal({ member, roles, onClose, onSave, saving }) {
  const [roleId, setRoleId] = useState(member.role_id)
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")
  const [err, setErr] = useState("")

  const selectedRole = roles.find(r => r.id === roleId)
  const touchesOwner = member.role_name === 'Owner' || selectedRole?.name === 'Owner'

  const submit = () => {
    if (!roleId) { setErr("Please select a role."); return }
    if (touchesOwner && (!reason.trim() || !notes.trim())) {
      setErr("Reason and identity verification notes are required for this role change.")
      return
    }
    const extra = touchesOwner ? { reason: reason.trim(), identity_verification_notes: notes.trim() } : {}
    onSave(roleId, extra)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <p className="text-base font-semibold text-gray-900">Change Role</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
        </div>
        <div className="px-6 py-4 space-y-3">
          <p className="text-sm text-gray-500">
            {member.first_name ? `${member.first_name} ${member.last_name}` : member.email}
          </p>
          <select value={roleId} onChange={e => { setRoleId(e.target.value); setErr("") }}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          {touchesOwner && (
            <OwnershipFields reason={reason} setReason={setReason} notes={notes} setNotes={setNotes} err="" />
          )}
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button onClick={onClose} disabled={saving}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={submit} disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Generic confirm modal for suspend / reactivate / remove / make-primary
//     on an Owner — always collects ownership fields, since (see note at
//     top of file) every actor in this component is the Founder. ─────────

const OWNERSHIP_ACTION_COPY = {
  suspend: {
    title: "Suspend this Owner?",
    body: m => `"${m.first_name ? `${m.first_name} ${m.last_name}` : m.email}" will lose access immediately. This is being done on the customer's behalf.`,
    confirmLabel: "Suspend",
    confirmClass: "bg-orange-500 hover:bg-orange-600",
  },
  reactivate: {
    title: "Reactivate this Owner?",
    body: m => `"${m.first_name ? `${m.first_name} ${m.last_name}` : m.email}" will regain access immediately.`,
    confirmLabel: "Reactivate",
    confirmClass: "bg-green-600 hover:bg-green-700",
  },
  remove: {
    title: "Remove this Owner?",
    body: m => `"${m.first_name ? `${m.first_name} ${m.last_name}` : m.email}" will permanently lose access to this business.`,
    confirmLabel: "Remove",
    confirmClass: "bg-red-500 hover:bg-red-600",
  },
  'make-primary': {
    title: "Transfer Primary Owner?",
    body: m => `"${m.first_name ? `${m.first_name} ${m.last_name}` : m.email}" will become the sole Primary Owner of this business. The current Primary Owner loses that status.`,
    confirmLabel: "Transfer",
    confirmClass: "bg-blue-600 hover:bg-blue-700",
  },
}

function OwnershipActionModal({ action, member, onConfirm, onCancel, loading }) {
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")
  const [err, setErr] = useState("")

  if (!action || !member) return null
  const copy = OWNERSHIP_ACTION_COPY[action]

  const submit = () => {
    if (!reason.trim() || !notes.trim()) {
      setErr("Reason and identity verification notes are required.")
      return
    }
    onConfirm(reason.trim(), notes.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <p className="text-base font-semibold text-gray-900">{copy.title}</p>
        <p className="mt-1.5 text-sm text-gray-500">{copy.body(member)}</p>
        <div className="mt-4">
          <OwnershipFields reason={reason} setReason={setReason} notes={notes} setNotes={setNotes} err={err} />
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onCancel} disabled={loading}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={submit} disabled={loading}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium text-white transition disabled:opacity-50 ${copy.confirmClass}`}>
            {loading ? "Working…" : copy.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Remove Confirm (non-Owner — no ownership fields needed) ─────────────

function RemoveConfirm({ member, onConfirm, onCancel, loading }) {
  if (!member) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <p className="text-base font-semibold text-gray-900">Remove team member?</p>
        <p className="mt-1.5 text-sm text-gray-500">
          "<strong className="text-gray-800">{member.first_name ? `${member.first_name} ${member.last_name}` : member.email}</strong>"
          will lose access to this business immediately. This is being done on the customer's behalf.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onCancel} disabled={loading}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="rounded-lg bg-red-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50">
            {loading ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TeamSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-gray-100" />)}
    </div>
  )
}

// ─── Main WorkspaceTeam ────────────────────────────────────────────────────────
//
// Stage A gave Founder read-only visibility. Stage B added action buttons for
// ROUTINE team actions on non-Owner members. Stage C (this version) extends
// full operational parity to Owner-role members too — invite an Owner,
// change an Owner's role (either direction), suspend/reactivate/remove an
// Owner, and transfer Primary Owner — all gated behind Edit Mode AND a
// mandatory reason + identity-verification-notes pair that gets dual-logged
// to this business's own Activity Log and the Founder's platform Audit Log.
// The backend (_founder_ownership_fields in teams/views.py) enforces this
// server-side regardless of what the UI does — this UI is the honest path,
// not the only line of defense.

export default function WorkspaceTeam({ isEditMode }) {
  const [members, setMembers] = useState([])
  const [roles, setRoles] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [inviteModal, setInviteModal] = useState(false)
  const [roleModalMember, setRoleModalMember] = useState(null)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [ownershipAction, setOwnershipAction] = useState(null) // { type, member }
  const [busyId, setBusyId] = useState(null)
  const [toast, setToast] = useState("")

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(""), 3000) }

  const fetchAll = async () => {
    setLoading(true)
    setError("")
    try {
      const [membersRes, rolesRes, activityRes] = await Promise.all([
        teamAPI.getMembers(true),
        teamAPI.getRoles(),
        teamAPI.getActivityLog({ pageSize: 20 }),
      ])
      setMembers(membersRes.data)
      setRoles(rolesRes.data)
      setActivity(activityRes.data.results)
    } catch (err) {
      setError(err?.response?.data?.error || "Could not load team data.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  // ── Non-Owner routine actions (Stage B, unchanged) ──
  const handleSuspend = async (member) => {
    setBusyId(member.id)
    try {
      await teamAPI.suspendMember(member.id)
      showToast("Member suspended.")
      fetchAll()
    } catch (e) {
      showToast(e?.response?.data?.error || "Failed to suspend member.")
    } finally {
      setBusyId(null)
    }
  }

  const handleReactivate = async (member) => {
    setBusyId(member.id)
    try {
      await teamAPI.reactivateMember(member.id)
      showToast("Member reactivated.")
      fetchAll()
    } catch (e) {
      showToast(e?.response?.data?.error || "Failed to reactivate member.")
    } finally {
      setBusyId(null)
    }
  }

  const handleRemove = async () => {
    setBusyId(removeTarget.id)
    try {
      await teamAPI.removeMember(removeTarget.id)
      showToast("Member removed.")
      setRemoveTarget(null)
      fetchAll()
    } catch (e) {
      showToast(e?.response?.data?.error || "Failed to remove member.")
    } finally {
      setBusyId(null)
    }
  }

  const handleChangeRole = async (roleId, extra = {}) => {
    setBusyId(roleModalMember.id)
    try {
      await teamAPI.changeMemberRole(roleModalMember.id, roleId, extra)
      showToast("Role updated.")
      setRoleModalMember(null)
      fetchAll()
    } catch (e) {
      showToast(e?.response?.data?.error || "Failed to change role.")
    } finally {
      setBusyId(null)
    }
  }

  // ── Owner-touching actions (Stage C) — always go through
  //    OwnershipActionModal, which always supplies reason + notes ──
  const handleOwnershipConfirm = async (reason, notes) => {
    const { type, member } = ownershipAction
    const extra = { reason, identity_verification_notes: notes }
    setBusyId(member.id)
    try {
      if (type === 'suspend') {
        await teamAPI.suspendMember(member.id, extra)
        showToast("Owner suspended.")
      } else if (type === 'reactivate') {
        await teamAPI.reactivateMember(member.id, extra)
        showToast("Owner reactivated.")
      } else if (type === 'remove') {
        await teamAPI.removeMember(member.id, extra)
        showToast("Owner removed.")
      } else if (type === 'make-primary') {
        await teamAPI.makePrimaryOwner(member.id, extra)
        showToast("Primary Owner transferred.")
      }
      setOwnershipAction(null)
      fetchAll()
    } catch (e) {
      showToast(e?.response?.data?.error || "Action failed.")
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <TeamSkeleton />

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-600 mb-1">Failed to load team data</p>
        <p className="text-xs text-red-400 mb-3">{error}</p>
        <button onClick={fetchAll}
          className="rounded-lg border border-red-200 bg-white px-4 py-1.5 text-sm text-red-600 hover:bg-red-50">
          Try again
        </button>
      </div>
    )
  }

  const primaryOwner = members.find(m => m.is_primary_owner)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Team</h2>
          <p className="text-xs text-gray-400">
            {isEditMode
              ? "Edit Mode — routine actions available on the customer's behalf. Owner-related actions require a reason and identity verification."
              : "Read-only — switch to Edit Mode to act on the customer's behalf."}
          </p>
        </div>
        {isEditMode && (
          <button onClick={() => setInviteModal(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition">
            + Invite Member
          </button>
        )}
      </div>

      {primaryOwner && (
        <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
          <p className="text-xs text-blue-700 font-medium">Primary Owner</p>
          <p className="text-sm text-blue-900 mt-0.5">
            {primaryOwner.first_name ? `${primaryOwner.first_name} ${primaryOwner.last_name}`.trim() : primaryOwner.email}
            <span className="text-blue-500 font-normal"> · {primaryOwner.email}</span>
          </p>
        </div>
      )}

      {/* Roster */}
      <div>
        <SectionTitle sub={`${members.length} member${members.length === 1 ? "" : "s"} (including invited/removed)`}>
          Members
        </SectionTitle>
        <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
          {members.map(m => {
            const isOwner = m.role_name === 'Owner'
            const busy = busyId === m.id
            return (
              <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600">
                  {(m.first_name?.[0] || m.email[0] || "?").toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate flex items-center gap-1.5">
                    {m.first_name ? `${m.first_name} ${m.last_name}`.trim() : m.email}
                    {m.is_primary_owner && (
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                        Primary Owner
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {m.email} · {m.role_name}
                  </p>
                </div>
                <StatusBadge status={m.status} />
                {isEditMode && m.status !== 'removed' && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setRoleModalMember(m)} disabled={busy}
                      className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 transition disabled:opacity-50">
                      Change Role
                    </button>
                    {m.status === 'active' && (
                      <button
                        onClick={() => isOwner ? setOwnershipAction({ type: 'suspend', member: m }) : handleSuspend(m)}
                        disabled={busy}
                        className="rounded-lg border border-orange-100 px-2.5 py-1 text-xs text-orange-600 hover:bg-orange-50 transition disabled:opacity-50">
                        Suspend
                      </button>
                    )}
                    {m.status === 'suspended' && (
                      <button
                        onClick={() => isOwner ? setOwnershipAction({ type: 'reactivate', member: m }) : handleReactivate(m)}
                        disabled={busy}
                        className="rounded-lg border border-green-100 px-2.5 py-1 text-xs text-green-600 hover:bg-green-50 transition disabled:opacity-50">
                        Reactivate
                      </button>
                    )}
                    {isOwner && m.status === 'active' && !m.is_primary_owner && (
                      <button onClick={() => setOwnershipAction({ type: 'make-primary', member: m })} disabled={busy}
                        className="rounded-lg border border-blue-100 px-2.5 py-1 text-xs text-blue-600 hover:bg-blue-50 transition disabled:opacity-50">
                        Make Primary
                      </button>
                    )}
                    <button
                      onClick={() => isOwner ? setOwnershipAction({ type: 'remove', member: m }) : setRemoveTarget(m)}
                      disabled={busy}
                      className="rounded-lg border border-red-100 px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 transition disabled:opacity-50">
                      Remove
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Roles */}
      <div>
        <SectionTitle sub="System roles available to this business">Roles</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {roles.map(r => (
            <div key={r.id} className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-sm font-medium text-gray-900">{r.name}</p>
              <p className="text-xs text-gray-400 mt-1">{r.description || "No description"}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <SectionTitle sub="Most recent 20 team actions">Recent Activity</SectionTitle>
        {activity.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
            <p className="text-sm text-gray-400">No activity recorded yet</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
            {activity.map(a => (
              <div key={a.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-gray-900">
                    <span className="font-medium">{a.actor_name}</span> — {a.action_label}
                    {a.target_name && <span className="text-gray-500"> · {a.target_name}</span>}
                  </p>
                  <p className="text-xs text-gray-400 flex-shrink-0">
                    {new Date(a.created_at).toLocaleString()}
                  </p>
                </div>
                {a.details?.founder_ownership_action && (
                  <p className="text-xs text-amber-600 mt-1">
                    Ownership action · {a.details.reason}
                  </p>
                )}
                {a.viewed_as && (
                  <p className="text-xs text-blue-500 mt-1">
                    while viewing as {a.viewed_as.name} ({a.viewed_as.role_name})
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Founder note */}
      <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
        <p className="text-xs text-blue-700 font-medium">📋 Founder Note</p>
        <p className="text-xs text-blue-600 mt-0.5">
          Switch to Edit Mode to act on the customer's behalf. Routine actions on non-Owner
          members are logged automatically. Any action touching an Owner — invite, role change,
          suspend, reactivate, remove, or Primary Owner transfer — requires a reason and
          identity-verification note, and is dual-logged to this business's Activity Log and
          your own platform Audit Log.
        </p>
      </div>

      {inviteModal && (
        <InviteModal roles={roles} onClose={() => setInviteModal(false)} onInvited={() => fetchAll()} />
      )}
      {roleModalMember && (
        <ChangeRoleModal member={roleModalMember} roles={roles} onClose={() => setRoleModalMember(null)}
          onSave={handleChangeRole} saving={busyId === roleModalMember.id} />
      )}
      <RemoveConfirm member={removeTarget} onConfirm={handleRemove} onCancel={() => setRemoveTarget(null)}
        loading={busyId === removeTarget?.id} />
      <OwnershipActionModal
        action={ownershipAction?.type} member={ownershipAction?.member}
        onConfirm={handleOwnershipConfirm} onCancel={() => setOwnershipAction(null)}
        loading={ownershipAction && busyId === ownershipAction.member.id} />
      <Toast message={toast} />
    </div>
  )
}
