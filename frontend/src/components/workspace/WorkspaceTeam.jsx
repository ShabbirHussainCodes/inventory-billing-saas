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

// ─── Invite Modal (Stage B — non-Owner roles only) ────────────────────────────
// Owner role is deliberately never offered here — inviting a new Owner is a
// sensitive ownership action, deferred to Stage C (mandatory reason +
// identity-verification-notes), not a routine one.

function InviteModal({ roles, onClose, onInvited }) {
  const nonOwnerRoles = roles.filter(r => r.name !== 'Owner')
  const [email, setEmail] = useState("")
  const [roleId, setRoleId] = useState(nonOwnerRoles[0]?.id || "")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")
  const [inviteLink, setInviteLink] = useState(null)

  const submit = async () => {
    if (!email.trim()) { setErr("Email is required."); return }
    if (!roleId) { setErr("Please select a role."); return }
    setSaving(true)
    setErr("")
    try {
      const res = await teamAPI.inviteMember({ email: email.trim(), role_id: roleId })
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
                  {nonOwnerRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <p className="mt-1 text-[11px] text-gray-400">
                  Owner isn't offered here — inviting a new Owner needs the Stage C ownership workflow.
                </p>
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
                {saving ? "Creating…" : "Create Invite"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Change Role Modal (non-Owner roles only) ─────────────────────────────────

function ChangeRoleModal({ member, roles, onClose, onSave, saving }) {
  const nonOwnerRoles = roles.filter(r => r.name !== 'Owner')
  const [roleId, setRoleId] = useState(member.role_id)
  const [err, setErr] = useState("")

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
            {nonOwnerRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <p className="text-[11px] text-gray-400">
            Promoting to Owner isn't offered here — that's a Stage C ownership action.
          </p>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button onClick={onClose} disabled={saving}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={() => (roleId ? onSave(roleId) : setErr("Please select a role."))} disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Remove Confirm ─────────────────────────────────────────────────────────

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
// Stage A gave Founder read-only visibility. Stage B adds real action
// buttons for ROUTINE team actions — invite, change role, suspend,
// reactivate, remove — gated behind Edit Mode like the rest of the
// workspace. Owner-role members are deliberately excluded from every
// action here (no buttons shown on their row, no "Owner" option in any
// role dropdown) — the backend hard-blocks those paths too
// (_block_founder_owner_action), so this UI restriction is belt-and-braces,
// not the only line of defense. Owner-related actions are Stage C's job.

export default function WorkspaceTeam({ isEditMode }) {
  const [members, setMembers] = useState([])
  const [roles, setRoles] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [inviteModal, setInviteModal] = useState(false)
  const [roleModalMember, setRoleModalMember] = useState(null)
  const [removeTarget, setRemoveTarget] = useState(null)
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

  const handleChangeRole = async (roleId) => {
    setBusyId(roleModalMember.id)
    try {
      await teamAPI.changeMemberRole(roleModalMember.id, roleId)
      showToast("Role updated.")
      setRoleModalMember(null)
      fetchAll()
    } catch (e) {
      showToast(e?.response?.data?.error || "Failed to change role.")
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
              ? "Edit Mode — routine actions available on the customer's behalf. Owner-related actions aren't here yet (Stage C)."
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
                {isEditMode && !isOwner && m.status !== 'removed' && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setRoleModalMember(m)} disabled={busyId === m.id}
                      className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 transition disabled:opacity-50">
                      Change Role
                    </button>
                    {m.status === 'active' && (
                      <button onClick={() => handleSuspend(m)} disabled={busyId === m.id}
                        className="rounded-lg border border-orange-100 px-2.5 py-1 text-xs text-orange-600 hover:bg-orange-50 transition disabled:opacity-50">
                        Suspend
                      </button>
                    )}
                    {m.status === 'suspended' && (
                      <button onClick={() => handleReactivate(m)} disabled={busyId === m.id}
                        className="rounded-lg border border-green-100 px-2.5 py-1 text-xs text-green-600 hover:bg-green-50 transition disabled:opacity-50">
                        Reactivate
                      </button>
                    )}
                    <button onClick={() => setRemoveTarget(m)} disabled={busyId === m.id}
                      className="rounded-lg border border-red-100 px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 transition disabled:opacity-50">
                      Remove
                    </button>
                  </div>
                )}
                {isOwner && (
                  <span className="flex-shrink-0 text-xs text-gray-400 px-1">Ownership actions — Stage C</span>
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
          Switch to Edit Mode to act on the customer's behalf (invite, change role, suspend,
          remove) for non-Owner members. Every action here is logged to both this business's
          Activity Log and your own platform audit trail. Owner-related actions aren't available
          yet — that's Stage C.
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
      <Toast message={toast} />
    </div>
  )
}
