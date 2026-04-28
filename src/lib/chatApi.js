const API_URL = import.meta.env.VITE_CHAT_API_URL;

function requireApiUrl() {
  if (!API_URL) {
    throw new Error("Chat API URL is not configured. Set VITE_CHAT_API_URL.");
  }
  return API_URL;
}

export async function sendChatMessage({ message, messages, accessToken }) {
  const response = await fetch(requireApiUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({
      message,
      messages,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "Assistant is unavailable.");
  }

  return data?.reply || "Sorry, I could not respond.";
}
