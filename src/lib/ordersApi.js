const BASE_URL = import.meta.env.VITE_ORDERS_API_URL;

function requireBaseUrl() {
  if (!BASE_URL) {
    throw new Error("Orders API URL is not configured. Set VITE_ORDERS_API_URL.");
  }
  return BASE_URL;
}

export async function placeOrder({ accessToken, items, customer }) {
  const response = await fetch(`${requireBaseUrl()}/place`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ items, customer }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.error || "Unable to place order.");
    err.code = data?.code;
    err.details = data;
    throw err;
  }

  return data?.order || null;
}
