const BASE_URL = import.meta.env.VITE_ADMIN_API_URL;

function requireBaseUrl() {
  if (!BASE_URL) {
    throw new Error("Admin API URL is not configured. Set VITE_ADMIN_API_URL.");
  }
  return BASE_URL;
}

async function request(path, { accessToken, method = "GET", body } = {}) {
  const response = await fetch(`${requireBaseUrl()}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "Admin request failed.");
  }
  return data;
}

export async function adminListProducts(accessToken, { limit = 200 } = {}) {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return request(`/products${suffix}`, { accessToken });
}

export async function adminUpdateProduct(accessToken, productId, patch) {
  return request(`/products/${encodeURIComponent(productId)}`, {
    accessToken,
    method: "PATCH",
    body: patch || {},
  });
}
