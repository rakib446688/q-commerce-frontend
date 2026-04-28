import { requireEnv } from "./env.js";
import { fetchJson } from "./http.js";

function normalizeBaseUrl(baseUrl) {
  const trimmed = String(baseUrl || "").trim();
  if (!trimmed) return "";
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function ensureV1BaseUrl(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return "";
  return normalized.endsWith("/v1") ? normalized : `${normalized}/v1`;
}

export async function lmStudioEmbed({
  input,
  timeoutMs = 20000,
} = {}) {
  const baseUrl = ensureV1BaseUrl(requireEnv("LMSTUDIO_BASE_URL"));
  const model = requireEnv("LMSTUDIO_EMBEDDING_MODEL");

  const normalizedInput = Array.isArray(input) ? input : [input];
  const safeInput = normalizedInput
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (!safeInput.length) throw new Error("lmStudioEmbed requires a non-empty input.");

  const url = `${baseUrl}/embeddings`;
  const data = await fetchJson(url, {
    method: "POST",
    timeoutMs,
    body: {
      model,
      input: safeInput.length === 1 ? safeInput[0] : safeInput,
    },
  });

  const embeddings = Array.isArray(data?.data)
    ? data.data.map((row) => row?.embedding).filter((e) => Array.isArray(e))
    : [];

  if (!embeddings.length) throw new Error("LM Studio embeddings response did not include embeddings.");

  return embeddings.length === 1 ? embeddings[0] : embeddings;
}
