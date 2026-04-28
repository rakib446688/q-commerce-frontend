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

export async function lmStudioChatComplete({
  messages,
  temperature = 0.4,
  maxTokens = 220,
  timeoutMs = 20000,
} = {}) {
  const baseUrl = ensureV1BaseUrl(requireEnv("LMSTUDIO_BASE_URL"));
  const model = requireEnv("LMSTUDIO_CHAT_MODEL");

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("lmStudioChatComplete requires a non-empty messages array.");
  }

  const url = `${baseUrl}/chat/completions`;
  const data = await fetchJson(url, {
    method: "POST",
    timeoutMs,
    body: {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    },
  });

  const content = data?.choices?.[0]?.message?.content;
  return String(content || "").trim();
}
