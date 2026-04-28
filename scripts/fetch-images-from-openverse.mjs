import fs from "node:fs/promises";
import path from "node:path";
import { loadProducts, readJson, slugToCategorySlug, writeJson } from "./catalog.mjs";

const OPENVERSE_API = "https://api.openverse.engineering/v1/images";
const PAGE_SIZE = 20;
const MIN_FETCH_INTERVAL_MS = 700;
const DOWNLOAD_TIMEOUT_MS = 30000;

const PREFERRED_SOURCES = ["rawpixel", "wikimedia", "flickr", "stocksnap"];
const BAD_TITLE_TERMS = [
  "clipart",
  "illustration",
  "vector",
  "icon",
  "logo",
  "svg",
  "eps",
  "psd",
  "template",
  "drawing",
  "sketch",
  "cartoon",
  "meme",
];

const BRAND_TERMS = ["nike", "adidas", "puma", "reebok", "apple", "samsung", "sony", "dell", "hp", "lenovo"];

let lastFetchAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeForMatch(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function throttledFetch(url, options) {
  const now = Date.now();
  const wait = Math.max(0, MIN_FETCH_INTERVAL_MS - (now - lastFetchAt));
  if (wait) await sleep(wait);
  lastFetchAt = Date.now();
  return fetch(url, {
    ...options,
    headers: {
      "user-agent": "q-commerce-catalog-script/1.0",
      ...(options?.headers || {}),
    },
  });
}

function safeFilePart(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function uniq(list) {
  return [...new Set(list.filter(Boolean).map((v) => String(v).trim()).filter(Boolean))];
}

function wordsFromSlug(slug, category) {
  const parts = String(slug).split("-").filter(Boolean);
  const categorySlug = slugToCategorySlug(category);
  const prefix = categorySlug === "home-living" ? "home" : categorySlug;
  const normalized = parts[0] === prefix ? parts.slice(1) : parts;
  return normalized.map((p) => p.replace(/[^a-z0-9]+/gi, "")).filter(Boolean);
}

function buildWantedKeywords(product) {
  const base = wordsFromSlug(product.slug, product.category);
  const titleWords = String(product.title || "")
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]+/g, ""))
    .filter(Boolean);

  const subcategory = String(product.subcategory || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  const wanted = uniq([...base, ...titleWords, ...subcategory.split(/\s+/)]);
  const expanded = new Set(wanted);
  const add = (...values) => {
    for (const value of values) {
      const trimmed = String(value || "").trim();
      if (trimmed) expanded.add(trimmed);
    }
  };

  if (expanded.has("tee")) add("shirt", "tshirt", "t shirt");
  if (expanded.has("tshirts") || expanded.has("shirts")) add("shirt", "t shirt");
  if (expanded.has("undershirt")) add("underwear", "undershirts", "tank", "tank top", "singlet");
  if (expanded.has("earbuds")) add("earphones", "earphone");
  if (expanded.has("router")) add("wifi", "wi fi");
  if (expanded.has("wifi")) add("wi fi");
  if (expanded.has("usbc")) add("usb c");
  if (expanded.has("pants")) add("trousers");
  if (expanded.has("sneakers")) add("shoes", "shoe");
  if (expanded.has("boots")) add("shoes", "shoe");
  if (expanded.has("pajama")) add("pyjama", "pyjamas");

  return uniq([...expanded]);
}

function genderHints(category) {
  if (category === "Women") return { good: ["woman", "women", "female", "girl"], bad: ["man", "men", "male", "boy"] };
  if (category === "Men") return { good: ["man", "men", "male"], bad: ["woman", "women", "female", "girl"] };
  if (category === "Kids") return { good: ["kid", "kids", "child", "children", "boy", "girl"], bad: [] };
  return { good: [], bad: [] };
}

function normalizeCandidateText(candidate) {
  const tags = Array.isArray(candidate?.tags) ? candidate.tags.map((t) => t?.name).filter(Boolean) : [];
  return normalizeForMatch(`${candidate?.title || ""} ${tags.join(" ")}`);
}

function isJpgUrl(url) {
  return /\.(jpe?g)(\?.*)?$/i.test(String(url || ""));
}

function sourceWeight(source) {
  const idx = PREFERRED_SOURCES.indexOf(String(source || "").toLowerCase());
  if (idx === -1) return 0;
  return (PREFERRED_SOURCES.length - idx) * 10;
}

function productKindTerms(product) {
  const title = normalizeForMatch(product?.title || "");
  const slugWords = normalizeForMatch(wordsFromSlug(product?.slug, product?.category).join(" "));
  const combined = `${title} ${slugWords}`.trim();

  if (!combined) return [];

  if (combined.includes("polo")) return ["polo shirt", "polo", "shirt"];
  if (combined.includes("oxford") && combined.includes("shirt")) return ["oxford shirt", "oxford", "shirt", "button down"];
  if (combined.includes("overshirt")) return ["overshirt", "shirt"];
  if (combined.includes("denim set")) return ["denim", "jeans", "jacket", "outfit"];
  if (combined.includes("runner shoes") || combined.includes("run shoes") || combined.includes("running shoes")) {
    return ["running shoes", "runner shoes", "running shoe", "sneakers", "sneaker", "shoe"];
  }

  if (combined.includes("phone case")) return ["phone case", "case"];
  if (combined.includes("usb c hub") || combined.includes("usb hub")) return ["usb c hub", "usb", "hub", "adapter", "dock"];
  if (combined.includes("power bank")) return ["power bank", "battery", "charger"];
  if (combined.includes("action camera")) return ["action camera", "camera"];
  if (combined.includes("webcam")) return ["webcam", "camera"];
  if (combined.includes("router")) return ["router", "wifi", "wi fi"];
  if (combined.includes("monitor")) return ["monitor", "display", "screen"];
  if (combined.includes("laptop")) return ["laptop", "notebook", "computer"];
  if (combined.includes("tablet")) return ["tablet"];
  if (combined.includes("earbuds")) return ["earbuds", "earphones", "earbud", "earphone"];
  if (combined.includes("headphones")) return ["headphones", "headphone"];
  if (combined.includes("smartwatch")) return ["smartwatch", "watch"];
  if (combined.includes("speaker")) return ["speaker"];
  if (combined.includes("keyboard")) return ["keyboard"];
  if (combined.includes("gaming mouse")) return ["gaming mouse", "mouse"];
  if (combined.includes("mouse")) return ["mouse"];
  if (combined.includes("smartphone")) return ["smartphone", "phone", "mobile"];

  if (combined.includes("table lamp")) return ["table lamp", "lamp"];
  if (combined.includes("floor lamp")) return ["floor lamp", "lamp"];
  if (combined.includes("throw pillow")) return ["throw pillow", "pillow", "cushion"];
  if (combined.includes("plant pot") || combined.includes("planter")) return ["plant pot", "planter", "pot"];
  if (combined.includes("storage basket")) return ["storage basket", "basket"];
  if (combined.includes("desk chair")) return ["desk chair", "chair"];
  if (combined.includes("side table")) return ["side table", "table"];
  if (combined.includes("wall art")) return ["wall art", "wall", "art", "print", "poster"];
  if (combined.includes("cutting board")) return ["cutting board", "chopping board", "board"];
  if (combined.includes("cookware")) return ["cookware", "pots", "pans", "pan", "pot"];
  if (combined.includes("coffee maker")) return ["coffee maker", "coffee machine", "espresso"];
  if (combined.includes("bedding")) return ["bedding", "duvet", "sheet"];
  if (combined.includes("towel")) return ["towel"];
  if (combined.includes("vase")) return ["vase"];
  if (combined.includes("lamp")) return ["lamp"];
  if (combined.includes("pillow")) return ["pillow", "cushion"];
  if (combined.includes("blanket")) return ["blanket", "throw"];
  if (combined.includes("basket")) return ["basket"];
  if (combined.includes("chair")) return ["chair"];
  if (combined.includes("table")) return ["table"];
  if (combined.includes("candle")) return ["candle"];

  if (combined.includes("pajama")) return ["pajama", "pajamas", "sleepwear"];
  if (combined.includes("windbreaker")) return ["windbreaker", "jacket"];
  if (combined.includes("rain jacket") || combined.includes("raincoat")) return ["rain jacket", "raincoat", "jacket"];
  if (combined.includes("trench coat")) return ["trench coat", "coat"];
  if (combined.includes("bomber jacket")) return ["bomber jacket", "bomber", "jacket"];
  if (combined.includes("parka jacket")) return ["parka jacket", "parka", "jacket"];

  if (combined.includes("jeans")) return ["jeans", "denim"];
  if (combined.includes("leggings")) return ["leggings"];
  if (combined.includes("cargo pants")) return ["cargo pants", "cargo", "pants", "trousers"];
  if (combined.includes("chino")) return ["chino", "chinos", "pants", "trousers"];
  if (combined.includes("joggers")) return ["joggers", "sweatpants", "pants", "trousers"];
  if (combined.includes("pants") || combined.includes("trousers")) return ["pants", "trousers"];
  if (combined.includes("hoodie")) return ["hoodie"];
  if (combined.includes("jacket")) return ["jacket", "coat"];
  if (combined.includes("coat")) return ["coat"];
  if (combined.includes("sneakers")) return ["sneakers", "sneaker", "shoes"];
  if (combined.includes("boots")) return ["boots", "boot", "shoes"];
  if (combined.includes("sandals")) return ["sandals", "sandal", "shoes"];
  if (combined.includes("trainers")) return ["trainers", "trainer", "shoes"];
  if (combined.includes("shoes")) return ["shoes", "shoe"];
  if (combined.includes("t shirt") || combined.includes("tshirt") || combined.includes("tee")) return ["t shirt", "tshirt", "shirt"];
  if (combined.includes("blouse")) return ["blouse", "top", "shirt"];
  if (combined.includes("sweater")) return ["sweater", "jumper"];
  if (combined.includes("top")) return ["top", "shirt", "blouse"];
  if (/\bshirt\b/.test(combined)) return ["shirt", "button down", "button-up", "button up"];

  if (combined.includes("hoop earrings")) return ["hoop earrings", "earrings", "earring"];
  if (combined.includes("earrings") || combined.includes("earring")) return ["earrings", "earring"];
  if (combined.includes("backpack")) return ["backpack", "bag"];
  if (combined.includes("baseball cap")) return ["baseball cap", "cap", "hat"];
  if (combined.includes("beanie")) return ["beanie", "hat"];
  if (combined.includes("cap")) return ["cap", "hat"];
  if (combined.includes("socks")) return ["socks", "sock"];
  if (combined.includes("undershirt")) return ["undershirt", "underwear", "tank top", "singlet"];
  if (combined.includes("thermal")) return ["thermal", "underwear"];
  if (combined.includes("bag")) return ["bag", "handbag", "purse"];

  const fallbackWord = wordsFromSlug(product?.slug, product?.category).slice(-1)[0];
  const fallback = normalizeForMatch(fallbackWord);
  return fallback ? [fallback] : [];
}

function matchesAny(text, terms) {
  if (!terms?.length) return true;
  return terms.some((term) => text.includes(term));
}

const REQUIRED_SLUG_QUALIFIERS = new Set([
  "action",
  "ankle",
  "baseball",
  "bomber",
  "cargo",
  "ceramic",
  "chino",
  "coffee",
  "cutting",
  "denim",
  "desk",
  "fleece",
  "floor",
  "gaming",
  "hoodie",
  "hoop",
  "knit",
  "leather",
  "mechanical",
  "oxford",
  "pajama",
  "parka",
  "plant",
  "polo",
  "power",
  "puffer",
  "rain",
  "rib",
  "run",
  "satin",
  "scent",
  "storage",
  "table",
  "thermal",
  "throw",
  "trench",
  "usb",
  "wall",
  "windbreaker",
  "zip",
]);

function requiredSlugQualifiers(product) {
  const slugWords = wordsFromSlug(product?.slug, product?.category);
  if (slugWords.length < 2) return [];
  return slugWords
    .slice(0, -1)
    .map((term) => normalizeForMatch(term))
    .filter((term) => term && REQUIRED_SLUG_QUALIFIERS.has(term));
}

function looksLikeCameraFilenameTitle(titleText) {
  const compact = String(titleText || "").replace(/\s+/g, "");
  if (!compact) return false;
  if (/^\d{6,}$/.test(compact)) return true;
  return /^(img|dsc|out|pxl|wp|mvimg|screenshot|scan|photo)\d+$/i.test(compact);
}

function looksLikeSpammyTitle(titleText) {
  const raw = String(titleText || "");
  if (!raw) return false;
  const hashes = (raw.match(/#/g) || []).length;
  if (hashes >= 6) return true;
  return raw.length >= 160;
}

function scoreCandidate(candidate, product, wanted, hints) {
  const primaryUrl = String(candidate?.url || "");
  const thumbUrl = String(candidate?.thumbnail || "");
  if (!primaryUrl && !thumbUrl) return -1_000_000;
  if (primaryUrl && !isJpgUrl(primaryUrl) && !thumbUrl) return -1_000_000;

  const titleText = normalizeForMatch(candidate?.title || "");
  const bodyText = normalizeForMatch(`${candidate?.title || ""} ${candidate?.description || ""}`);
  const tagsText = normalizeForMatch(
    (Array.isArray(candidate?.tags) ? candidate.tags.map((t) => t?.name).filter(Boolean) : []).join(" ")
  );
  const text = `${bodyText} ${tagsText}`.trim();

  const fieldsMatched = Array.isArray(candidate?.fields_matched) ? candidate.fields_matched : [];
  const matchedTitle = fieldsMatched.includes("title");
  const matchedDescription = fieldsMatched.includes("description");
  const matchedTags = fieldsMatched.some((field) => String(field).startsWith("tags"));

  const kindTerms = productKindTerms(product);
  if (kindTerms.length && !matchesAny(text, kindTerms)) return -100_000;
  if (kindTerms.length && !matchesAny(bodyText, kindTerms)) return -100_000;

  // Strong penalties for obvious non-photo / non-product assets
  for (const term of BAD_TITLE_TERMS) {
    if (text.includes(term)) return -100_000;
  }

  // Avoid brand-heavy results (best-effort)
  for (const brand of BRAND_TERMS) {
    if (text.includes(brand)) return -10_000;
  }

  const qualifiers = requiredSlugQualifiers(product);
  if (qualifiers.length && !matchesAny(bodyText, qualifiers)) return -100_000;

  let score = 0;
  score += sourceWeight(candidate.source);

  // Prefer CC0, then anything commercial-friendly
  if (String(candidate.license || "").toLowerCase() === "cc0") score += 15;
  if (String(candidate.license || "").toLowerCase() === "pdm") score += 12;

  // Prefer results that matched query in title/description vs tags only
  if (matchedTitle) score += 12;
  if (matchedDescription) score += 6;
  if (matchedTags && !matchedTitle && !matchedDescription) score -= 18;

  // Prefer descriptive titles over camera filenames
  if (looksLikeCameraFilenameTitle(titleText)) score -= 18;
  if (looksLikeSpammyTitle(candidate?.title || "")) score -= 18;

  // Prefer kind terms appearing in the title (tags can be noisy)
  if (kindTerms.length && !matchesAny(titleText, kindTerms)) score -= 10;

  // Higher resolution helps (when provided)
  const width = Number(candidate.width || 0);
  const height = Number(candidate.height || 0);
  if (width && height) {
    const minDim = Math.min(width, height);
    if (minDim >= 1200) score += 10;
    else if (minDim >= 900) score += 6;
    else if (minDim >= 700) score += 2;
    else score -= 4;
  }

  // Match product keywords
  let bodyMatches = 0;
  let tagMatches = 0;
  for (const key of wanted) {
    if (key.length < 3) continue;
    const singular = key.endsWith("s") && key.length > 3 ? key.slice(0, -1) : "";
    if (bodyText.includes(key) || (singular && bodyText.includes(singular))) bodyMatches += 1;
    else if (tagsText.includes(key) || (singular && tagsText.includes(singular))) tagMatches += 1;
  }
  if (bodyMatches === 0) return -100_000;
  score += bodyMatches * 6 + tagMatches * 2;

  if (qualifiers.length) {
    const qualifierMatches = qualifiers.reduce((count, term) => count + (bodyText.includes(term) ? 1 : 0), 0);
    score += qualifierMatches * 8;
  }

  // Category/gender hints
  for (const good of hints.good) if (text.includes(good)) score += 4;
  for (const bad of hints.bad) if (text.includes(bad)) score -= 6;

  // Nudge toward more product-like tags when available
  if (product?.category === "Electronics" && (text.includes("laptop") || text.includes("phone") || text.includes("headphones"))) {
    score += 6;
  }
  if (product?.category === "Home & Living" && (text.includes("lamp") || text.includes("vase") || text.includes("pillow") || text.includes("blanket"))) {
    score += 6;
  }

  return score;
}

function simplifyVariantQuery(query) {
  const raw = String(query || "").trim();
  if (!raw) return "";
  return raw
    .replace(/\bproduct\s+photo\b/gi, "")
    .replace(/\bstudio\s+photo\b/gi, "")
    .replace(/\bproduct\b/gi, "")
    .replace(/\bphoto\b/gi, "")
    .replace(/\bstudio\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function loosenVariantQuery(query) {
  const raw = String(query || "").trim();
  if (!raw) return "";
  return raw
    .replace(/\bset\b/gi, "")
    .replace(/\bpack\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function expandedVariantQueries(product) {
  const variants = Array.isArray(product.image_variants) ? product.image_variants.map((v) => v?.query).filter(Boolean) : [];
  const expanded = [];
  for (const query of variants) {
    expanded.push(query);
    const simplified = simplifyVariantQuery(query);
    if (simplified) expanded.push(simplified);
    const loosened = loosenVariantQuery(simplified || query);
    if (loosened) expanded.push(loosened);
  }
  return uniq(expanded);
}

function buildQueries(product) {
  const baseWords = wordsFromSlug(product.slug, product.category).join(" ");
  const title = String(product.title || "").trim();
  const titleAlt = /\btee\b/i.test(title) ? title.replace(/\btee\b/i, "t-shirt") : title;
  const sub = String(product.subcategory || "").trim();

  const variants = expandedVariantQueries(product);
  const kindTerms = productKindTerms(product);
  const kindSeeds = kindTerms.slice(0, 2);
  const hints = genderHints(product.category);

  const genderPrefix =
    product.category === "Women"
      ? ["women", "woman"]
      : product.category === "Men"
         ? ["men", "man"]
         : product.category === "Kids"
           ? ["kids", "child"]
            : [];

  const queries = [
    ...variants,
    `${titleAlt} ${sub}`.trim(),
    `${titleAlt}`.trim(),
    `${titleAlt} product`.trim(),
    `${titleAlt} isolated`.trim(),
    `${baseWords} ${sub}`.trim(),
    `${baseWords} product`.trim(),
    `${baseWords} isolated`.trim(),
    `${sub} ${product.category}`.trim(),
    baseWords,
    title,
  ];

  // Add gender-prefixed queries, but keep variants first
  for (const prefix of genderPrefix) {
    queries.push(`${prefix} ${titleAlt} ${sub}`.trim());
    queries.push(`${prefix} ${baseWords} ${sub}`.trim());
    queries.push(`${prefix} ${titleAlt}`.trim());
    queries.push(`${prefix} ${baseWords}`.trim());
  }

  // Also allow hint tokens to appear in search
  for (const token of hints.good.slice(0, 2)) {
    queries.push(`${token} ${titleAlt}`.trim());
    queries.push(`${token} ${baseWords}`.trim());
  }

  // Kind fallbacks last (can be generic)
  for (const term of kindSeeds) {
    queries.push(term);
    queries.push(`${term} product`.trim());
    queries.push(`${term} isolated`.trim());
  }

  return uniq(queries).filter(Boolean).slice(0, 32);
}

async function searchOpenverse(query, extraParams = {}) {
  const params = new URLSearchParams({
    q: query,
    mature: "false",
    license_type: "commercial",
    page_size: String(PAGE_SIZE),
    ...Object.fromEntries(Object.entries(extraParams).filter(([, v]) => v !== undefined && v !== null)),
  });

  const url = `${OPENVERSE_API}?${params.toString()}`;
  const maxRetries = 4;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await throttledFetch(url);
    if (response.ok) return response.json();

    const retryable = response.status === 429 || (response.status >= 500 && response.status < 600);
    if (!retryable || attempt === maxRetries) throw new Error(`Openverse API failed (${response.status})`);

    let waitMs = 1200 * (attempt + 1);
    const retryAfter = response.headers.get("retry-after");
    const seconds = Number(retryAfter);
    if (response.status === 429 && Number.isFinite(seconds) && seconds > 0) {
      waitMs = Math.max(waitMs, seconds * 1000);
    }

    await sleep(waitMs);
  }

  throw new Error("Openverse API failed (unknown)");
}

async function pickBestCandidate(product, options = {}) {
  const wanted = buildWantedKeywords(product);
  const hints = genderHints(product.category);
  const queries = buildQueries(product);
  const usedUrls = options?.usedUrls instanceof Set ? options.usedUrls : null;
  const blockedUrls = options?.blockedUrls instanceof Set ? options.blockedUrls : null;
  const allowUsed = options?.allowUsed === true;

  const sourceAttempts = [
    { source: "rawpixel" },
    { source: "flickr" },
    { source: "stocksnap", license: "cc0" },
    { source: "wikimedia" },
    {},
  ];

  for (const query of queries) {
    for (const attempt of sourceAttempts) {
      const data = await searchOpenverse(query, attempt);
      const results = Array.isArray(data?.results) ? data.results : [];
      if (!results.length) continue;

      const scored = results
        .map((candidate) => ({
          candidate,
          score: scoreCandidate(candidate, product, wanted, hints),
        }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score);

      if (scored.length) {
        for (const item of scored) {
          if (!allowUsed && usedUrls && usedUrls.has(item.candidate.url)) continue;
          if (blockedUrls && blockedUrls.has(item.candidate.url)) continue;
          return { candidate: item.candidate, matchedQuery: query, attempt };
        }
      }
    }
  }

  return null;
}

async function downloadJpg(url, outPath) {
  const maxRetries = 4;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    try {
      const response = await throttledFetch(url, { signal: controller.signal, redirect: "follow" });
      if (response.ok) {
        const contentType = String(response.headers.get("content-type") || "").toLowerCase();
        const isJpeg = contentType.includes("image/jpeg") || contentType.includes("image/jpg");
        if (!isJpeg) throw new Error(`Download failed (non-jpeg ${contentType || "unknown"}) ${url}`);

        const buf = Buffer.from(await response.arrayBuffer());
        if (buf.length < 3 || buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error(`Download failed (invalid jpeg) ${url}`);
        await fs.writeFile(outPath, buf);
        return;
      }

      const retryable = response.status === 429 || (response.status >= 500 && response.status < 600);
      if (!retryable || attempt === maxRetries) throw new Error(`Download failed (${response.status}) ${url}`);

      let waitMs = 1500 * (attempt + 1);
      const retryAfter = response.headers.get("retry-after");
      const seconds = Number(retryAfter);
      if (response.status === 429 && Number.isFinite(seconds) && seconds > 0) {
        waitMs = Math.max(waitMs, seconds * 1000);
      }

      await sleep(waitMs);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(`Download failed (unknown) ${url}`);
}

async function downloadCandidateJpg(candidate, outPath) {
  const urls = uniq([candidate?.url, candidate?.thumbnail]);
  let lastError = null;
  for (const url of urls) {
    try {
      await downloadJpg(url, outPath);
      return url;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Download failed (no urls)");
}

function attributionLine(localPath, record) {
  const parts = [
    `- \`${localPath}\``,
    record?.attribution ? `— ${record.attribution}` : "",
    record?.foreign_landing_url ? `(${record.foreign_landing_url})` : "",
  ].filter(Boolean);
  return parts.join(" ");
}

async function buildCategoryTileImages() {
  const tiles = await readJson("data/category-tiles.json");
  const attributions = [];
  const usedUrls = new Set();
  const blockedUrls = new Set();

  for (const tile of tiles) {
    const outDir = path.join("public", "categories");
    const fileName = `${safeFilePart(tile.slug)}.jpg`;
    const outPath = path.join(outDir, fileName);

    await ensureDir(outDir);

    let pick = await pickBestCandidate({
      slug: tile.slug,
      title: tile.label,
      category: tile.category,
      subcategory: "",
      image_variants: [{ query: tile.query }],
    }, { usedUrls, blockedUrls });

    if (!pick) throw new Error(`No Openverse image found for category tile: ${tile.label}`);

    const maxPickAttempts = 6;
    for (let attempt = 0; attempt < maxPickAttempts; attempt += 1) {
      try {
        await downloadCandidateJpg(pick.candidate, outPath);
        usedUrls.add(pick.candidate.url || pick.candidate.thumbnail);
        break;
      } catch (error) {
        blockedUrls.add(pick.candidate.url);
        if (attempt === maxPickAttempts - 1) throw error;
        pick = await pickBestCandidate(
          {
            slug: tile.slug,
            title: tile.label,
            category: tile.category,
            subcategory: "",
            image_variants: [{ query: tile.query }],
          },
          { usedUrls, blockedUrls }
        );
        if (!pick) throw new Error(`No Openverse image found for category tile: ${tile.label}`);
      }
    }

    attributions.push(attributionLine(`public/categories/${fileName}`, pick.candidate));
  }

  const md = `# Image Attribution (Categories)\n\n${attributions.join("\n")}\n`;
  await fs.writeFile(path.join("public", "categories", "ATTRIBUTION.md"), md, "utf8");
}

async function buildProductImages() {
  const products = await loadProducts();
  const withImages = [];
  const attributions = [];
  const usedUrls = new Set();
  const blockedUrls = new Set();

  for (const product of products) {
    const categorySlug = slugToCategorySlug(product.category);
    const outDir = path.join("public", "products", categorySlug);
    await ensureDir(outDir);

    const fileName = `${safeFilePart(product.slug)}.jpg`;
    const outPath = path.join(outDir, fileName);
    const webPath = `/products/${categorySlug}/${fileName}`;

    let pick = null;
    let usedKey = "";
    const maxPickAttempts = 6;
    for (let attempt = 0; attempt < maxPickAttempts; attempt += 1) {
      pick = await pickBestCandidate(product, { usedUrls, blockedUrls });
      if (!pick && usedUrls.size) pick = await pickBestCandidate(product, { usedUrls, blockedUrls, allowUsed: true });
      if (!pick) break;
      try {
        await downloadCandidateJpg(pick.candidate, outPath);
        usedKey = pick.candidate.url || pick.candidate.thumbnail || "";
        if (usedKey) usedUrls.add(usedKey);
        break;
      } catch (error) {
        blockedUrls.add(pick.candidate.url);
        if (attempt === maxPickAttempts - 1) throw error;
      }
    }

    if (!pick || !usedKey || !usedUrls.has(usedKey)) {
      throw new Error(`No Openverse image found for product: ${product.slug} (${product.title})`);
    }

    attributions.push(attributionLine(`public/products/${categorySlug}/${fileName}`, pick.candidate));

    const colorImages = {};
    for (const color of product.colors || []) colorImages[color] = webPath;

    withImages.push({
      ...product,
      category_slug: categorySlug,
      color_images: colorImages,
      sources: [
        {
          provider: "openverse",
          matched_query: pick.matchedQuery,
          source: pick.candidate.source,
          url: pick.candidate.url,
          landing_url: pick.candidate.foreign_landing_url,
          license: pick.candidate.license,
          license_url: pick.candidate.license_url,
          creator: pick.candidate.creator,
          creator_url: pick.candidate.creator_url,
          attribution: pick.candidate.attribution,
        },
      ],
    });
  }

  await writeJson("data/catalog.products.with-images.json", withImages);

  const md = `# Image Attribution (Products)\n\nImages are downloaded via Openverse and stored locally in this repo.\n\n${attributions.join(
    "\n"
  )}\n`;
  await ensureDir(path.join("public", "products"));
  await fs.writeFile(path.join("public", "products", "ATTRIBUTION.md"), md, "utf8");

  const localCatalog = (withImages || []).map((p) => ({
    id: p.slug,
    db_id: null,
    legacy_id: p.slug,
    slug: p.slug,
    title: p.title || "",
    category: p.category || "",
    subcategory: p.subcategory || "",
    price: Number.isFinite(Number(p.price)) ? Number(p.price) : 0,
    rating_avg: Number.isFinite(Number(p.rating_avg)) ? Number(p.rating_avg) : 0,
    rating_count: Number.isFinite(Number(p.rating_count)) ? Number(p.rating_count) : 0,
    colors: Array.isArray(p.colors) ? p.colors : [],
    sizes: Array.isArray(p.sizes) ? p.sizes : [],
    color_images: p.color_images || {},
    description: p.description || "",
    brand: p.brand || "",
    is_active: true,
    stock_qty: Number.isFinite(Number(p.stock_qty)) ? Number(p.stock_qty) : 0,
    _localCatalog: true,
  }));

  await ensureDir(path.join("src", "lib", "catalog"));
  await fs.writeFile(
    path.join("src", "lib", "catalog", "productsCatalog.json"),
    `${JSON.stringify(localCatalog, null, 2)}\n`,
    "utf8"
  );
}

async function main() {
  const debugSlug = String(process.env.OPENVERSE_DEBUG_SLUG || "").trim();
  if (debugSlug) {
    const products = await loadProducts();
    const product = products.find((p) => p?.slug === debugSlug);
    if (!product) throw new Error(`Unknown product slug: ${debugSlug}`);

    const queries = buildQueries(product);
    console.log("Debug slug:", debugSlug);
    console.log("Queries:", queries);

    const pick = await pickBestCandidate(product, { usedUrls: new Set(), blockedUrls: new Set(), allowUsed: true });
    if (!pick) {
      console.log("No pick found.");
      return;
    }

    console.log({
      matchedQuery: pick.matchedQuery,
      source: pick.candidate.source,
      url: pick.candidate.url,
      foreign_landing_url: pick.candidate.foreign_landing_url,
      license: pick.candidate.license,
      title: pick.candidate.title,
    });

    await ensureDir("tmp");
    const outPath = path.join("tmp", `${safeFilePart(product.slug)}.jpg`);
    await downloadCandidateJpg(pick.candidate, outPath);
    console.log("Downloaded to:", outPath);
    return;
  }

  await buildCategoryTileImages();
  await buildProductImages();
  console.log(
    "Done. Downloaded images into `public/` and updated `data/catalog.products.with-images.json` and `src/lib/catalog/productsCatalog.json`."
  );
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exitCode = 1;
});
