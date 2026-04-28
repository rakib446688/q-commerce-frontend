function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function getAdminEmailAllowlist() {
  const raw = String(import.meta.env.VITE_ADMIN_EMAILS || "");
  return raw
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);
}

export function isAdminUser(user) {
  const email = normalizeEmail(user?.email);
  if (!email) return false;
  const allowlist = getAdminEmailAllowlist();
  return allowlist.includes(email);
}

