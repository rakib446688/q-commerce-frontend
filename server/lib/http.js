export async function fetchJson(url, { method = "GET", headers, body, timeoutMs = 20000 } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(headers || {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || data?.error || response.statusText || "Request failed.";
      const error = new Error(message);
      error.status = response.status;
      error.details = data;
      throw error;
    }

    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

