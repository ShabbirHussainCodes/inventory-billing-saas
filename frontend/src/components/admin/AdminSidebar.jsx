import { NavLink } from "react-router-dom"
import { adminNav } from "./adminNav"
import { getUser, getInitials } from "../../utils/auth"
import Icon from "./icons"

// Reusable sidebar.
// Props:
//   open       -> mobile drawer khula hai ya nahi
//   onNavigate -> mobile pe link click hone par drawer band karne ke liye
export default function AdminSidebar({ open = false, onNavigate = () => {} }) {
  const user = getUser()

  return (
    <>
      {/* Mobile overlay — drawer khule hone par background dim */}
      <div
        onClick={onNavigate}
        className={`fixed inset-0 z-30 bg-black/30 transition-opacity md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-200 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand + Founder Mode badge */}
        <div className="px-5 pb-4 pt-5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Icon name="planet" className="h-4 w-4" />
            </span>
            <span className="text-[15px] font-semibold text-gray-900">
              BillingMars
            </span>
          </div>
          <span className="mt-3 inline-block rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-600">
            Founder mode
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 px-3">
          {adminNav.map((item) =>
            item.soon ? (
              <div
                key={item.to}
                className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400"
                aria-disabled="true"
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
                <span className="ml-auto rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-gray-400">
                  soon
                </span>
              </div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-blue-50 text-blue-600"
                      : "text-gray-600 hover:bg-gray-50"
                  }`
                }
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </NavLink>
            )
          )}
        </nav>

        {/* Founder identity */}
        <div className="mt-2 flex items-center gap-3 border-t border-gray-200 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600">
            {getInitials(user)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-gray-900">
              {user.first_name
                ? `${user.first_name} ${user.last_name || ""}`.trim()
                : user.email || "Founder"}
            </p>
            <p className="truncate text-[11px] text-gray-400">Platform owner</p>
          </div>
        </div>
      </aside>
    </>
  )
}