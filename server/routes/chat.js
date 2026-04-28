import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getEnv } from "../lib/env.js";
import { createSupabaseAnonClient, createSupabaseUserClient } from "../lib/supabase.js";
import { isMeilisearchConfigured, meilisearchSearch } from "../lib/meilisearch.js";
import { lmStudioChatComplete } from "../lib/lmstudioChat.js";

const router = express.Router();

const LLM_TIMEOUT_MS = 20000;
const NO_THINK_SUFFIX = "\n/no_think";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_CATALOG_PATH = path.resolve(__dirname, "../../src/lib/catalog/productsCatalog.json");

const STOPWORDS = new Set([
  "give",
  "show",
  "want",
  "need",
  "find",
  "looking",
  "search",
  "recommend",
  "suggest",
  "tell",
  "get",
  "buy",
  "please",
  "something",
  "anything",
  "some",
  "any",
]);

const QUERY_SYNONYMS = new Map([
  ["pants", ["trousers"]],
  ["trousers", ["pants"]],
  ["joggers", ["sweatpants"]],
  ["sweatpants", ["joggers"]],
  ["hoodie", ["hoodies"]],
  ["hoodies", ["hoodie"]],
  ["sneakers", ["trainers"]],
  ["trainers", ["sneakers"]],
]);

const APPAREL_TOKENS = new Set([
  "pants",
  "trousers",
  "jeans",
  "joggers",
  "sweatpants",
  "leggings",
  "shorts",
  "skirt",
  "dress",
  "shirt",
  "t-shirt",
  "tshirt",
  "tee",
  "top",
  "blouse",
  "hoodie",
  "hoodies",
  "sweater",
  "jumper",
  "jacket",
  "coat",
  "shoes",
  "sneakers",
  "trainers",
  "boots",
  "socks",
  "cap",
  "hat",
]);

const ELECTRONICS_TOKENS = new Set([
  "laptop",
  "phone",
  "tablet",
  "earbuds",
  "earphones",
  "headphones",
  "speaker",
  "tv",
  "camera",
  "smartwatch",
  "watch",
  "keyboard",
  "mouse",
  "charger",
  "cable",
]);

const HOME_TOKENS = new Set([
  "cushion",
  "pillow",
  "blanket",
  "throw",
  "lamp",
  "table",
  "chair",
  "sofa",
  "rug",
  "vase",
  "decor",
  "mirror",
  "bedding",
]);

let localCatalogCache = null;

function getChatMode() {
  const raw = String(getEnv("CHAT_MODE") || getEnv("VITE_CHAT_MODE") || "open").trim().toLowerCase();
  return raw === "grounded" ? "grounded" : "open";
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function tokenize(text) {
  return normalizeText(text)
    .replace(/[^a-z0-9\s&-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => token.length >= 3 || /^\d+$/.test(token))
    .filter((token) => !STOPWORDS.has(token));
}

function expandQueryTokens(tokens) {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    const extra = QUERY_SYNONYMS.get(token);
    if (!extra) continue;
    extra.forEach((value) => expanded.add(value));
  }
  return Array.from(expanded);
}

function inferQueryDomain(tokens) {
  let apparel = 0;
  let electronics = 0;
  let home = 0;

  for (const token of tokens) {
    if (APPAREL_TOKENS.has(token)) apparel += 1;
    if (ELECTRONICS_TOKENS.has(token)) electronics += 1;
    if (HOME_TOKENS.has(token)) home += 1;
  }

  const max = Math.max(apparel, electronics, home);
  if (max === 0) return "";
  if (max === apparel) return "apparel";
  if (max === electronics) return "electronics";
  return "home";
}

function getLocalCatalogProducts() {
  if (localCatalogCache) return localCatalogCache;
  try {
    const raw = fs.readFileSync(LOCAL_CATALOG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    localCatalogCache = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Could not load local catalog for chat:", error?.message || error);
    localCatalogCache = [];
  }
  return localCatalogCache;
}

function scoreProduct(product, query) {
  const q = normalizeText(query);
  const baseTokens = tokenize(query);
  const tokens = expandQueryTokens(baseTokens);
  const domain = inferQueryDomain(tokens);
  const phrase = baseTokens.join(" ");

  const title = normalizeText(product.title);
  const category = normalizeText(product.category);
  const subcategory = normalizeText(product.subcategory);
  const brand = normalizeText(product.brand);
  const description = normalizeText(product.description);
  const colors = normalizeText(Array.isArray(product.colors) ? product.colors.join(" ") : "");
  const sizes = normalizeText(Array.isArray(product.sizes) ? product.sizes.join(" ") : "");

  const primary = `${title} ${category} ${subcategory}`;
  const secondary = `${brand} ${description} ${colors} ${sizes}`;

  let score = 0;

  if (domain === "apparel" && !["men", "women", "kids"].includes(category)) {
    return 0;
  }
  if (domain === "electronics" && category !== "electronics") {
    return 0;
  }
  if (domain === "home" && category !== "home & living") {
    return 0;
  }

  for (const token of tokens) {
    if (primary.includes(token)) {
      score += 6;
    } else if (secondary.includes(token)) {
      score += 2;
    }
  }

  if (phrase && title.includes(phrase)) score += 12;
  if (phrase && subcategory.includes(phrase)) score += 6;

  if (q.includes("under")) {
    const match = q.match(/under\s*(?:\u00A3|gbp|\$)?\s*(\d+)/i);
    if (match) {
      const max = Number(match[1]);
      if (Number.isFinite(max) && Number(product.price) <= max) {
        score += 4;
      } else {
        score -= 2;
      }
    }
  }

  if (q.includes("men") && normalizeText(product.category) === "men") score += 3;
  if (q.includes("women") && normalizeText(product.category) === "women") score += 3;
  if (q.includes("kids") && normalizeText(product.category) === "kids") score += 3;
  if (q.includes("electronics") && normalizeText(product.category) === "electronics") score += 3;
  if ((q.includes("home") || q.includes("living")) && normalizeText(product.category) === "home & living") score += 3;

  return score;
}

async function fetchRelevantProducts(message) {
  const q = String(message || "").trim();
  if (!q) return [];

  if (isMeilisearchConfigured()) {
    try {
      const hits = await meilisearchSearch({
        query: q,
        limit: 12,
        filter: "is_active = true",
      });

      return hits
        .map((hit) => ({
          id: hit.id,
          slug: hit.slug,
          title: hit.title,
          category: hit.category,
          subcategory: hit.subcategory,
          price: hit.price,
          rating_avg: hit.rating_avg,
          rating_count: hit.rating_count,
          colors: hit.colors,
          sizes: hit.sizes,
          description: hit.description,
          brand: hit.brand,
          is_active: hit.is_active,
        }))
        .filter((product) => product?.slug && product?.title)
        .slice(0, 8);
    } catch (error) {
      console.warn("Meilisearch retrieval failed; falling back to catalog:", error?.message || error);
    }
  }

  const localProducts = getLocalCatalogProducts().filter((product) => product?.is_active !== false);
  let products = localProducts;

  // If local catalog isn't available for some reason, fall back to Supabase.
  if (!products.length) {
    const supabase = createSupabaseAnonClient();
    const { data, error } = await supabase
      .from("products")
      .select(`
        id,
        slug,
        title,
        category,
        subcategory,
        price,
        rating_avg,
        rating_count,
        colors,
        sizes,
        description,
        brand,
        is_active
      `)
      .eq("is_active", true)
      .limit(200);

    if (error) throw error;
    products = Array.isArray(data) ? data : [];
  }

  return products
    .map((product) => ({
      ...product,
      __score: scoreProduct(product, q),
    }))
    .filter((product) => product.__score > 0)
    .sort((a, b) => b.__score - a.__score)
    .slice(0, 8)
    .map((product) => {
      const copy = { ...product };
      delete copy.__score;
      return copy;
    });
}

async function fetchRecentOrders(accessToken) {
  if (!accessToken) return [];

  const supabase = createSupabaseUserClient(accessToken);

  const { data, error } = await supabase
    .from("orders")
    .select(`
      id,
      total,
      status,
      created_at,
      order_items (
        title,
        quantity,
        price,
        color,
        size
      )
    `)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.warn("Could not fetch user orders for chatbot:", error.message);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

function buildProductsContext(products) {
  if (!products.length) {
    return "No specific matching products were found in the current store data.";
  }

  return [
    "Relevant store products:",
    ...products.map((product, index) => {
      const colors = Array.isArray(product.colors) && product.colors.length
        ? product.colors.join(", ")
        : "not specified";

      const sizes = Array.isArray(product.sizes) && product.sizes.length
        ? product.sizes.join(", ")
        : "not specified";

      return `${index + 1}. ${product.title} | category: ${product.category} | subcategory: ${product.subcategory || "none"} | price: GBP ${Number(product.price).toFixed(2)} | brand: ${product.brand || "Q-Commerce"} | colors: ${colors} | sizes: ${sizes} | rating: ${product.rating_avg ?? 0} (${product.rating_count ?? 0} reviews) | slug: ${product.slug || "n/a"} | description: ${product.description || "No description"}`;
    }),
  ].join("\n");
}

function buildOrdersContext(orders) {
  if (!orders.length) {
    return "No recent user order data is available for this request.";
  }

  return [
    "Recent user orders:",
    ...orders.map((order, index) => {
      const items = Array.isArray(order.order_items)
        ? order.order_items
            .map((item) => `${item.title} x${item.quantity}`)
            .join(", ")
        : "No item details";

      return `${index + 1}. Order ${order.id} | status: ${order.status} | total: GBP ${Number(order.total).toFixed(2)} | placed: ${order.created_at} | items: ${items}`;
    }),
  ].join("\n");
}

function wantsOrderHelp(message) {
  const q = normalizeText(message);
  return [
    "my order",
    "recent order",
    "orders",
    "order status",
    "track",
    "delivery",
    "checkout",
    "purchase",
  ].some((keyword) => q.includes(keyword));
}

function stripThinkBlock(text) {
  return String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
}

router.post("/", async (req, res) => {
  try {
    const { message } = req.body || {};

    if (!String(message || "").trim()) {
      return res.status(400).json({
        error: "Message is required.",
      });
    }

    const history = Array.isArray(req.body?.history)
      ? req.body.history
      : Array.isArray(req.body?.messages)
        ? req.body.messages
        : [];

    const authHeader = req.headers.authorization || "";
    const accessToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

    let products = [];
    let orders = [];

    try {
      products = await fetchRelevantProducts(message);
    } catch (err) {
      console.warn("Chat product retrieval failed; continuing without product context:", err?.message || err);
      products = [];
    }

    if (wantsOrderHelp(message)) {
      try {
        orders = await fetchRecentOrders(accessToken);
      } catch (err) {
        console.warn("Chat order retrieval failed; continuing without order context:", err?.message || err);
        orders = [];
      }
    }

    const mode = getChatMode();
    const systemPrompt =
      mode === "grounded"
        ? `
You are the AI shopping assistant for Q-Commerce Store.

Your job:
- help users discover relevant products
- answer product and category questions using only the provided store context
- answer order questions only when order context is provided
- do not invent products, prices, order details, or stock information
- if exact data is not available, say that clearly
- keep responses helpful, natural, and concise
- when recommending products, mention title, price, and why they match

Strict rules:
- When the user asks for products/recommendations, you MUST only mention products listed under "Relevant store products".
- If "Relevant store products" contains no matches, say you couldn't find a match and ask 1–2 clarifying questions.
`.trim()
        : `
You are the AI shopping assistant for Q-Commerce Store.

You can:
- help users discover relevant products
- answer product and category questions using store context when provided
- help with styling advice (outfit ideas, colours, occasions, fit tips)
- help with order questions when order context is provided
- also chat freely and answer general questions (the user requested open chat)

Rules:
- when stating specific product facts (price, colours, sizes, descriptions), use store context if available
- when stating specific order facts, use order context if available
- if something is unknown, say so instead of inventing details
- keep replies helpful and natural

Strict rules:
- When the user asks for products/recommendations, you MUST only mention products listed under "Relevant store products".
- If "Relevant store products" contains no matches, say you couldn't find a match and ask 1–2 clarifying questions.
`.trim();

    const contextBlock = [
      buildProductsContext(products),
      buildOrdersContext(orders),
    ].join("\n\n");

    const safeHistory = Array.isArray(history)
      ? history
          .filter((item) => item && typeof item.role === "string" && typeof item.content === "string")
          .filter((item) => ["user", "assistant"].includes(item.role))
          .slice(-8)
      : [];

    let reply = "";
    try {
      const llmMessages = [
        {
          role: "system",
          content: `${systemPrompt}\n\nStore context:\n${contextBlock}\n\nKeep replies concise (<= 120 words).`,
        },
        ...safeHistory,
      ];

      const lastRole = llmMessages.length ? llmMessages[llmMessages.length - 1]?.role : "";
      if (lastRole !== "user") {
        llmMessages.push({
          role: "user",
          content: `${String(message).trim()}${NO_THINK_SUFFIX}`,
        });
      } else {
        llmMessages[llmMessages.length - 1] = {
          role: "user",
          content: `${String(llmMessages[llmMessages.length - 1]?.content || "").trim()}${NO_THINK_SUFFIX}`,
        };
      }

      const content = await lmStudioChatComplete({
        messages: llmMessages,
        temperature: 0.4,
        maxTokens: 220,
        timeoutMs: LLM_TIMEOUT_MS,
      });

      reply = stripThinkBlock(content);
    } catch (error) {
      console.error("Chat LLM error:", error?.message || error);
      return res.status(502).json({
        error: "Assistant is unavailable. Ensure LM Studio is running and LMSTUDIO_BASE_URL + LMSTUDIO_CHAT_MODEL are set.",
      });
    }

    if (!reply) reply = "I could not generate a response.";

    return res.json({
      reply,
      mode,
      productsUsed: products.map((product) => ({
        id: product.id,
        slug: product.slug,
        title: product.title,
        price: product.price,
        category: product.category,
      })),
      ordersUsed: orders.map((order) => ({
        id: order.id,
        total: order.total,
        status: order.status,
        created_at: order.created_at,
      })),
    });
  } catch (error) {
    console.error("Chat route error:", error);

    return res.status(500).json({
      error: error?.message || "Chat request failed.",
    });
  }
});

export default router;
