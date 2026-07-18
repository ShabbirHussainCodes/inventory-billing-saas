import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import Layout from "../components/Layout"
import { teamAPI } from "../services/api"
import { getUser } from "../utils/auth"
import RolesManager from "../components/RolesManager"

// ─── Status badge ───────────────────────────────────────────────────────────

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

// ─── Invite Modal ───────────────────────────────────────────────────────────

function InviteModal({ roles, onClose, onInvited }) {
  const [email, setEmail] = useState("")
  const [roleId, setRoleId] = useState(roles[0]?.id || "")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")
  const [inviteLink, setInviteLink] = useState(null)
  const [copied, setCopied] = useState(false)

  const submit = async () => {
    if (!email.trim()) { setErr("Email is required."); return }
    if (!roleId) { setErr("Please select a role."); return }
    setSaving(true)
    setErr("")
    try {
      const res = await teamAPI.inviteMember({ email: email.trim(), role_id: roleId })
      const link = `${window.location.origin}/accept-invite/${res.data.invite_token}`
      setInviteLink(link)
      onInvited()
    } catch (e) {
      setErr(e?.response?.data?.error || "Failed to create invite.")
    } finally {
      setSaving(false)
    }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <p className="text-base font-semibold text-gray-900">
            {inviteLink ? "Invite created" : "Invite a team member"}
          </p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
        </div>

        {inviteLink ? (
          <div className="px-6 py-5 space-y-3">
            <p className="text-sm text-gray-600">
              There's no automatic email — copy this link and send it to <strong>{email}</strong> yourself
              (WhatsApp, email, however you'd like). It's valid for 7 days.
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <input readOnly value={inviteLink}
                className="flex-1 min-w-0 truncate bg-transparent text-xs text-gray-700 focus:outline-none" />
              <button onClick={copyLink}
                className="flex-shrink-0 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700">
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
            <div className="flex justify-end pt-1">
              <button onClick={onClose}
                className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-800">
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
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                {roles.find(r => r.id === roleId)?.description && (
                  <p className="mt-1 text-xs text-gray-400">{roles.find(r => r.id === roleId).description}</p>
                )}
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

// ─── Change Role Modal ──────────────────────────────────────────────────────

function ChangeRoleModal({ member, roles, onClose, onSave, saving }) {
  const [roleId, setRoleId] = useState(member.role_id)
  const [err, setErr] = useState("")

  const submit = () => {
    if (!roleId) { setErr("Please select a role."); return }
    onSave(roleId)
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
            {roles.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
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

// ─── Remove Confirm ─────────────────────────────────────────────────────────

function RemoveConfirm({ member, onConfirm, onCancel, loading }) {
  if (!member) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <p className="text-base font-semibold text-gray-900">Remove team member?</p>
        <p className="mt-1.5 text-sm text-gray-500">
          "<strong className="text-gray-800">{member.first_name ? `${member.first_name} ${member.last_name}` : member.email}</strong>"
          will lose access to this business immediately.
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

// ─── Make Primary Owner Confirm (Phase B.6 Stage 1) ────────────────────────

function MakePrimaryConfirm({ member, onConfirm, onCancel, loading }) {
  if (!member) return null
  const name = member.first_name ? `${member.first_name} ${member.last_name}`.trim() : member.email
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <p className="text-base font-semibold text-gray-900">Make {name} the Primary Owner?</p>
        <p className="mt-1.5 text-sm text-gray-500">
          You'll remain a full Owner, but <strong className="text-gray-800">{name}</strong> will
          become the one Primary Owner — the only person who can suspend, remove, or demote
          another Owner. You can hand it back to yourself later the same way.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onCancel} disabled={loading}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Transferring…" : "Make Primary Owner"}
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
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-gray-100" />)}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function TeamPage() {
  // Backend blocks changing/suspending/removing your OWN membership (avoids
  // accidental self-lockout) — this compares by email to hide those actions
  // on your own row too, so the button simply isn't there instead of
  // failing with a confusing error after you click it.
  const currentUserEmail = getUser().email
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [canManage, setCanManage] = useState(false)
  // Phase C — role.manage_custom is a SEPARATE permission from team.manage
  // (only Owner has it by default; Manager has team.manage but not this).
  // Probed independently, since canManage=true doesn't imply this.
  const [canManageRoles, setCanManageRoles] = useState(false)
  const [showRolesManager, setShowRolesManager] = useState(false)
  const [members, setMembers] = useState([])
  const [roles, setRoles] = useState([])
  const [showRemoved, setShowRemoved] = useState(false)

  const [inviteModal, setInviteModal] = useState(false)
  const [roleModalMember, setRoleModalMember] = useState(null)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [makePrimaryTarget, setMakePrimaryTarget] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [toast, setToast] = useState("")

  // Phase B.6 Stage 1 — am I the current Primary Owner? Only they see the
  // "Make Primary Owner" action on other Owners' rows.
  const myMembership = members.find(m => m.email === currentUserEmail)
  const isPrimaryOwner = myMembership?.is_primary_owner === true

  // Progressive disclosure — a solo shop owner with no teammates yet has
  // zero use for the custom-roles/permission-editor UI, even if they're
  // on a plan that technically allows it. Only surface "Manage Roles"
  // once there's actually a team to manage roles FOR (someone invited
  // or already active, besides yourself). Nothing is blocked here —
  // this is purely about not showing a button with nothing behind it.
  const hasTeammates = members.some(m => m.email !== currentUserEmail && m.status !== 'removed')

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(""), 3000) }

  const fetchAll = async (includeRemoved = showRemoved) => {
    setLoading(true)
    try {
      const membersRes = await teamAPI.getMembers(includeRemoved)
      setMembers(membersRes.data)
      setAccessDenied(false)

      // team.manage-only probe — 200 means full management, 403 means
      // read-only (team.view_activity got them past the members check above)
      try {
        const rolesRes = await teamAPI.getRoles()
        setRoles(rolesRes.data)
        setCanManage(true)
      } catch {
        setCanManage(false)
      }

      // role.manage_custom probe — separate from team.manage above.
      // Cheap: just try the permission catalog, 200 vs 403.
      try {
        await teamAPI.getPermissionCatalog()
        setCanManageRoles(true)
      } catch {
        setCanManageRoles(false)
      }
    } catch (err) {
      if (err?.response?.status === 403) {
        setAccessDenied(true)
      } else {
        showToast("Failed to load team.")
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleShowRemoved = () => {
    const next = !showRemoved
    setShowRemoved(next)
    fetchAll(next)
  }

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

  // Phase B.5 — View As Member. Only the Owner can start one (Founder
  // starts theirs from inside Support Mode, not from here) — `canManage`
  // already means "has team.manage", which per the finalized permission
  // matrix is Owner-exclusive, so it doubles as the right gate here too.
  const handleViewAs = async (member) => {
    setBusyId(member.id)
    try {
      await teamAPI.startViewAs(member.id)
      navigate("/dashboard")
    } catch (e) {
      showToast(e?.response?.data?.error || "Failed to start View As.")
    } finally {
      setBusyId(null)
    }
  }

  // Phase B.6 Stage 1 — voluntary Primary Owner handoff
  const handleMakePrimary = async () => {
    setBusyId(makePrimaryTarget.id)
    try {
      await teamAPI.makePrimaryOwner(makePrimaryTarget.id)
      showToast(`${makePrimaryTarget.first_name || makePrimaryTarget.email} is now the Primary Owner.`)
      setMakePrimaryTarget(null)
      fetchAll()
    } catch (e) {
      showToast(e?.response?.data?.error || "Failed to transfer Primary Owner.")
    } finally {
      setBusyId(null)
    }
  }

  if (!loading && accessDenied) {
    return (
      <Layout>
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-sm font-medium text-gray-900 mb-1">You don't have access to Team Management</p>
          <p className="text-xs text-gray-400">Ask your business Owner if you need to see this.</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="text-base font-semibold text-gray-900">Team Management</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {canManage ? "Invite staff, manage roles and access" : "View your team (read-only)"}
          </p>
        </div>
        <a href="/team/activity"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition">
          Activity Log →
        </a>
        {canManageRoles && hasTeammates && (
          <button onClick={() => setShowRolesManager(true)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition">
            Manage Roles
          </button>
        )}
        {canManage && (
          <button onClick={() => setInviteModal(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition">
            + Invite Member
          </button>
        )}
      </div>

      <div className="mb-4 flex items-center gap-2">
        <button onClick={toggleShowRemoved}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            showRemoved ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}>
          {showRemoved ? "Hide removed" : "Show removed"}
        </button>
      </div>

      {loading ? (
        <Skeleton />
      ) : members.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-sm font-medium text-gray-900 mb-1">No team members yet</p>
          {canManage && (
            <button onClick={() => setInviteModal(true)} className="mt-2 text-sm text-blue-600 hover:underline">
              Invite your first team member →
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/60 transition">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600">
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
              {m.email === currentUserEmail ? (
                <span className="flex-shrink-0 text-xs text-gray-400 px-1">This is you</span>
              ) : canManage && m.status !== 'removed' && (
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
                  {m.status === 'active' && (
                    <button onClick={() => handleViewAs(m)} disabled={busyId === m.id}
                      className="rounded-lg border border-blue-100 px-2.5 py-1 text-xs text-blue-600 hover:bg-blue-50 transition disabled:opacity-50">
                      {busyId === m.id ? "…" : "View As"}
                    </button>
                  )}
                  {isPrimaryOwner && m.role_name === 'Owner' && m.status === 'active' && !m.is_primary_owner && (
                    <button onClick={() => setMakePrimaryTarget(m)} disabled={busyId === m.id}
                      className="rounded-lg border border-blue-100 px-2.5 py-1 text-xs text-blue-600 hover:bg-blue-50 transition disabled:opacity-50">
                      Make Primary
                    </button>
                  )}
                  <button onClick={() => setRemoveTarget(m)} disabled={busyId === m.id}
                    className="rounded-lg border border-red-100 px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 transition disabled:opacity-50">
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {inviteModal && (
        <InviteModal roles={roles} onClose={() => setInviteModal(false)} onInvited={() => fetchAll()} />
      )}
      {roleModalMember && (
        <ChangeRoleModal member={roleModalMember} roles={roles} onClose={() => setRoleModalMember(null)}
          onSave={handleChangeRole} saving={busyId === roleModalMember.id} />
      )}
      <RemoveConfirm member={removeTarget} onConfirm={handleRemove} onCancel={() => setRemoveTarget(null)}
        loading={busyId === removeTarget?.id} />
      <MakePrimaryConfirm member={makePrimaryTarget} onConfirm={handleMakePrimary} onCancel={() => setMakePrimaryTarget(null)}
        loading={busyId === makePrimaryTarget?.id} />
      {showRolesManager && (
        <RolesManager roles={roles} onClose={() => setShowRolesManager(false)}
          onRolesChanged={() => fetchAll()} />
      )}
      <Toast message={toast} />
    </Layout>
  )
}
