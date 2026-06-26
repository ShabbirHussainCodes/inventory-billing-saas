import { useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import AdminSidebar from "./AdminSidebar"
import AdminTopbar from "./AdminTopbar"
import { adminNav } from "./adminNav"

// Founder Command Center ka shell.
// Sidebar + topbar fixed rehte hain, beech mein routed pages <Outlet/> se render hote hain.
export default function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  // Current route se page title nikalo (longest matching path)
  const active = [...adminNav]
    .filter((item) => !item.soon)
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) =>
      item.end
        ? location.pathname === item.to
        : location.pathname.startsWith(item.to)
    )
  const title = active ? active.label : "Founder Console"

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar
        open={drawerOpen}
        onNavigate={() => setDrawerOpen(false)}
      />

      {/* Content area — desktop pe sidebar ke right shift hota hai */}
      <div className="md:pl-64">
        <AdminTopbar
          onMenuClick={() => setDrawerOpen(true)}
          title={title}
        />
        <main className="mx-auto max-w-7xl p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}