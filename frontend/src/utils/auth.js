// Centralized auth helpers — ek hi jagah, sab jagah reuse
// localStorage keys ek hi format mein rahein isliye yahan wrap kiya hai

const ACCESS_KEY = "access_token"
const REFRESH_KEY = "refresh_token"
const USER_KEY = "user"

export function getToken() {
  return localStorage.getItem(ACCESS_KEY)
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "{}")
  } catch {
    return {}
  }
}

export function isAuthenticated() {
  return Boolean(getToken())
}

export function isSuperAdmin() {
  return getUser().role === "super_admin"
}

export function clearAuth() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USER_KEY)
}

// User ke naam se initials banao — avatar ke liye
export function getInitials(user = getUser()) {
  const f = (user.first_name || "").trim()
  const l = (user.last_name || "").trim()
  if (f || l) return `${f[0] || ""}${l[0] || ""}`.toUpperCase()
  const email = user.email || ""
  return (email[0] || "?").toUpperCase()
}