import { Navigate } from "react-router-dom"
import { getToken, getUser } from "../utils/auth"

// Role guard.
// - Token nahi hai        -> login pe bhej do
// - Role match nahi karta -> apne normal dashboard pe bhej do (admin area se bahar)
//
// Usage:
//   <RoleRoute role="super_admin"><AdminLayout/></RoleRoute>
export default function RoleRoute({ role, children }) {
  const token = getToken()
  if (!token) {
    return <Navigate to="/" replace />
  }

  const user = getUser()
  if (role && user.role !== role) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}