// Founder console ka navigation — single source of truth
// Naya section add karna ho toh bas yahan ek entry daalo
// soon: true => abhi disabled, "soon" pill ke saath dikhega

export const adminNav = [
  { to: "/admin", label: "Overview", icon: "dashboard", end: true },
  { to: "/admin/businesses", label: "Businesses", icon: "businesses" },
  { to: "/admin/users", label: "Users", icon: "users" },
  { to: "/admin/analytics", label: "Analytics", icon: "analytics", soon: true },
  { to: "/admin/audit", label: "Audit log", icon: "audit" },
  { to: "/admin/settings", label: "Settings", icon: "settings" },
]