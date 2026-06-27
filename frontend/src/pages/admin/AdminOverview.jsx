import { useState, useEffect } from "react"
import { superAdminAPI } from "../../services/api"
import StatCard from "../../components/admin/StatCard"
import NeedsAttention from "../../components/admin/NeedsAttention"
import SignupTrend from "../../components/admin/SignupTrend"
import ActivityFeed from "../../components/admin/ActivityFeed"

// Loading skeleton
function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 animate-pulse">
      <div className="h-3.5 w-24 rounded bg-gray-100 mb-3" />
      <div className="h-7 w-16 rounded bg-gray-100" />
    </div>
  )
}

function SkeletonBlock({ h = "h-40" }) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white ${h} animate-pulse`} />
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2"><SkeletonBlock h="h-44" /></div>
        <SkeletonBlock h="h-44" />
      </div>
      <SkeletonBlock h="h-64" />
    </div>
  )
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] rounded-2xl border border-red-100 bg-red-50 text-center p-8">
      <p className="text-sm font-medium text-red-600 mb-1">Failed to load dashboard</p>
      <p className="text-xs text-red-400 mb-4">{message}</p>
      <button
        onClick={onRetry}
        className="rounded-lg border border-red-200 bg-white px-4 py-1.5 text-sm text-red-600 hover:bg-red-50 transition"
      >
        Try again
      </button>
    </div>
  )
}

export default function AdminOverview() {
  const [stats, setStats] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchAll = async () => {
    setLoading(true)
    setError("")
    try {
      // Dono calls parallel mein — faster load
      const [statsRes, dashRes] = await Promise.all([
        superAdminAPI.getStats(),
        superAdminAPI.getDashboard(),
      ])
      setStats(statsRes.data)
      setDashboard(dashRes.data)
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          "Could not reach the server. Check your connection."
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  if (loading) return <LoadingSkeleton />
  if (error) return <ErrorState message={error} onRetry={fetchAll} />

  const planMix =
    [
      stats.paid_tenants ? `${stats.paid_tenants} paid` : null,
      stats.free_tenants ? `${stats.free_tenants} free` : null,
      stats.admin_grant_tenants ? `${stats.admin_grant_tenants} granted` : null,
    ]
      .filter(Boolean)
      .join(' · ') || '—'

  return (
    <div className="space-y-3">
      {/* Row 1 — Core platform counts */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total businesses" value={stats.total_tenants} />
        <StatCard title="Active" value={stats.active_tenants} variant="success" />
        <StatCard
          title="Suspended"
          value={stats.suspended_tenants}
          variant={stats.suspended_tenants > 0 ? 'danger' : 'default'}
        />
        <StatCard title="Total users" value={stats.total_users} />
      </div>

      {/* Row 2 — Growth + plan mix + locked future tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="New this month"
          value={`+${stats.new_this_month}`}
          variant="success"
          sub="signups"
        />
        <StatCard
          title="Plan mix"
          value={planMix}
          compact
          sub="paid · free · granted"
        />
        <StatCard
          title="MRR"
          locked
          sub="Available with subscriptions module"
        />
        <StatCard
          title="Platform revenue"
          locked
          sub="Available with subscriptions module"
        />
      </div>

      {/* Row 3 — Needs Attention + Signup Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <NeedsAttention data={dashboard.needs_attention} />
        </div>
        <SignupTrend data={dashboard.signup_trend} />
      </div>

      {/* Row 4 — Activity Feed */}
      <ActivityFeed data={dashboard.activity_feed} />
    </div>
  )
}