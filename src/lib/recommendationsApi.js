const API_URL = import.meta.env.VITE_RECOMMENDATIONS_API_URL;

function requireApiUrl() {
  if (!API_URL) {
    throw new Error("Recommendations API URL is not configured. Set VITE_RECOMMENDATIONS_API_URL.");
  }
  return API_URL;
}

export async function getRecommendations({ query = "", limit = 8 } = {}) {
  const response = await fetch(requireApiUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      limit,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "Recommendations are unavailable.");
  }

  return {
    recommendations: Array.isArray(data?.recommendations) ? data.recommendations : [],
    source: data?.source || "",
    model: data?.model || "",
  };
}
