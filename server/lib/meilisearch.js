import { getEnv, requireEnv } from "./env.js";
import { fetchJson } from "./http.js";

function normalizeBaseUrl(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function getMeiliConfig() {
  const baseUrl = normalizeBaseUrl(requireEnv("MEILISEARCH_URL"));
  const apiKey = requireEnv("MEILISEARCH_API_KEY");
  const index = getEnv("MEILISEARCH_INDEX") || "products";
  return { baseUrl, apiKey, index };
}

export function isMeilisearchConfigured() {
  return Boolean(getEnv("MEILISEARCH_URL") && getEnv("MEILISEARCH_API_KEY"));
}

export async function meilisearchSearch({ query, limit = 10, filter } = {}) {
  const { baseUrl, apiKey, index } = getMeiliConfig();

  const body = {
    q: String(query || "").trim(),
    limit: Math.max(1, Math.min(50, Number(limit) || 10)),
    ...(filter ? { filter } : {}),
  };

  const data = await fetchJson(`${baseUrl}/indexes/${encodeURIComponent(index)}/search`, {
    method: "POST",
    timeoutMs: 15000,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body,
  });

  return Array.isArray(data?.hits) ? data.hits : [];
}
