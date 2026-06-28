import { useNavigate } from "react-router-dom"
import { clearAuth } from "../../utils/auth"
import { authAPI } from "../../services/api"
import Icon from "./icons"

export default function AdminTopbar({ onMenuClick = () => {}, title = "" }) {
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      // Refresh token blacklist karo — server side logout
      const refresh = localStorage.getItem("refresh_token")
      if (refresh) {
        await authAPI.logout({ refresh })
      }
    } catch {
      // API fail hone pe bhi logout karo — client side always clear
    } finally {
      clearAuth()
      navigate("/")
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-gray-200 bg-white/90 px-4 backdrop-blur md:px-6">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 md:hidden"
        aria-label="Open menu"
      >
        <Icon name="menu" />
      </button>

      <p className="text-[15px] font-semibold text-gray-900">{title}</p>

      <div className="ml-auto">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
        >
          <Icon name="logout" className="h-4 w-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  )
}