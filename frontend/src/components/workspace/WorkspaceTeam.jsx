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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TeamSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-gray-100" />)}
    </div>
  )
}

// ─── Main WorkspaceTeam (Stage A — Founder read-only visibility) ─────────────
//
// Reuses the exact same backend endpoints the tenant's own Team page uses
// (member_list, role_list, activity_log_list). No new backend permission
// logic was needed for this — Founder's GET requests during a support
// session are already allowed unconditionally (has_permission()'s Founder
// branch), so this is purely a visibility surface. Deliberately has NO
// action buttons at all, even in Edit Mode — per the agreed philosophy,
// team governance stays untouchable from here until Stage B/C land.

export default function WorkspaceTeam() {
  const [members, setMembers] = useState([])
  const [roles, setRoles] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchAll = async () => {
    setLoading(true)
    setError("")
    try {
      const [membersRes, rolesRes, activityRes] = await Promise.all([
        teamAPI.getMembers(true),        // include removed — Founder should see the full history
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
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Team</h2>
        <p className="text-xs text-gray-400">
          Read-only — for diagnosing support requests (roles, permissions, invitations, activity).
          Team governance actions aren't available from here yet.
        </p>
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
          {members.map(m => (
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
            </div>
          ))}
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
          Use this to diagnose "my staff can't do X" requests — check their role below,
          then confirm which permissions that role actually has via the Roles section.
          Acting on their behalf (inviting, changing roles, suspending) isn't available
          from this tab yet.
        </p>
      </div>
    </div>
  )
}
