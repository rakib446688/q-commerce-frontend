import fs from "node:fs/promises";
import path from "node:path";
import { getCatalogPaths, loadProducts, readJson, slugToCategorySlug, writeJson } from "./catalog.mjs";

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const MIN_FETCH_INTERVAL_MS = 8000;
let lastFetchAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttledFetch(url, options) {
  const now = Date.now();
  const wait = Math.max(0, MIN_FETCH_INTERVAL_MS - (now - lastFetchAt));
  if (wait) await sleep(wait);
  lastFetchAt = Date.now();
  return fetch(url, options);
}

function getMetaValue(meta, key) {
  const entry = meta?.[key];
  if (!entry) return "";
  const value = typeof entry === "object" && "value" in entry ? entry.value : entry;
  return String(value || "").trim();
}

function isAcceptableLicense(extmetadata) {
  const license = getMetaValue(extmetadata, "LicenseShortName");
  const licenseUrl = getMetaValue(extmetadata, "LicenseUrl");
  const usage = getMetaValue(extmetadata, "UsageTerms");
  const lower = `${license} ${usage}`.toLowerCase();

  if (!license && !licenseUrl) return false;
  if (lower.includes("all rights reserved")) return false;
  if (lower.includes("non-free")) return false;
  if (lower.includes("fair use")) return false;

  return true;
}

async function commonsSearchCandidates(query) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: `${query} filetype:bitmap`,
    gsrlimit: "10",
    gsrnamespace: "6",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "1400",
  });

  const url = `${COMMONS_API}?${params.toString()}`;
  let data = null;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const response = await throttledFetch(url, { headers: { "user-agent": "q-commerce-catalog-script/1.0" } });
    if (response.status === 429) {
      await sleep(60000);
      continue;
    }
    if (!response.ok) throw new Error(`Commons API failed (${response.status})`);
    data = await response.json();
    break;
  }
  if (!data) throw new Error("Commons API rate-limited repeatedly (429)");

  const pages = Object.values(data?.query?.pages || {});
  const candidates = [];
  for (const page of pages) {
    const info = page?.imageinfo?.[0];
    const imageUrl = info?.thumburl || info?.url;
    const extmetadata = info?.extmetadata;
    if (!imageUrl || !extmetadata) continue;
    if (!isAcceptableLicense(extmetadata)) continue;
    if (!/\.(jpe?g|png)$/i.test(imageUrl)) continue;

    candidates.push({
      pageId: page.pageid,
      title: page.title,
      imageUrl,
      extmetadata,
    });
  }

  return candidates;
}

function buildQueryFallbacks(query) {
  const clean = String(query).trim();
  const simplified = clean.replace(/\b(product|studio)\b/gi, " ").replace(/\s+/g, " ").trim();
  const words = simplified.split(/\s+/).filter(Boolean);
  const short = words.slice(0, 4).join(" ");
  const fallbacks = [
    clean,
    `${clean} photo`,
    simplified,
    `${simplified} photo`,
    short,
    `${short} photo`,
  ]
    .map((q) => q.trim())
    .filter(Boolean);

  return [...new Set(fallbacks)];
}

async function commonsSearchWithFallback(query) {
  const fallbacks = buildQueryFallbacks(query);
  const seen = new Set();
  const all = [];
  for (const q of fallbacks) {
    const results = await commonsSearchCandidates(q);
    for (const candidate of results) {
      if (seen.has(candidate.imageUrl)) continue;
      seen.add(candidate.imageUrl);
      all.push({ ...candidate, matchedQuery: q });
    }
  }
  return all;
}

async function downloadFile(url, filePath) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const response = await throttledFetch(url, {
      headers: {
        "user-agent": "q-commerce-catalog-script/1.0",
        referer: "https://commons.wikimedia.org/",
      },
    });
    if (response.status === 429) {
      const waitMs = 12000;
      await sleep(waitMs);
      continue;
    }
    if (!response.ok) throw new Error(`Download failed (${response.status}) ${url}`);
    const buf = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(filePath, buf);
    return;
  }
  const err = new Error(`Download rate-limited repeatedly (429) ${url}`);
  err.code = "RATE_LIMITED";
  throw err;
}

function safeFilePart(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function attributionLine({ localPath, source }) {
  const license = getMetaValue(source.extmetadata, "LicenseShortName");
  const licenseUrl = getMetaValue(source.extmetadata, "LicenseUrl");
  const artist = getMetaValue(source.extmetadata, "Artist") || getMetaValue(source.extmetadata, "Credit");
  const objectName = getMetaValue(source.extmetadata, "ObjectName");

  const parts = [
    `- \`${localPath}\``,
    objectName ? `— ${objectName}` : "",
    artist ? `— ${artist}` : "",
    license ? `— ${license}` : "",
    licenseUrl ? `— ${licenseUrl}` : "",
    source.imageUrl ? `— ${source.imageUrl}` : "",
  ].filter(Boolean);

  return parts.join(" ");
}

async function buildCategoryTileImages() {
  const paths = getCatalogPaths();
  const tiles = await readJson(paths.categoryTiles);
  const results = [];

  for (const tile of tiles) {
    const fileName = `${tile.slug}.jpg`;
    const outDir = path.join("public", "categories");
    const outPath = path.join(outDir, fileName);
    const webPath = `/categories/${fileName}`;

    await ensureDir(outDir);
    const exists = await fs
      .stat(outPath)
      .then(() => true)
      .catch(() => false);

    let source = null;
    if (!exists) {
      const candidates = await commonsSearchWithFallback(tile.query);
      for (const candidate of candidates) {
        try {
          await downloadFile(candidate.imageUrl, outPath);
          source = candidate;
          break;
        } catch (err) {
          if (err?.code === "RATE_LIMITED") continue;
          throw err;
        }
      }
      if (!source) throw new Error(`No usable Commons image found for: ${tile.query}`);
      await sleep(150);
    }

    results.push({ ...tile, file: fileName, webPath, source });
  }

  await writeJson("data/category-tiles.with-images.json", results);
  return results;
}

async function buildProductImages() {
  const products = await loadProducts();
  const attributions = [];
  const withImages = [];

  for (const product of products) {
    const categorySlug = slugToCategorySlug(product.category);
    const outDir = path.join("public", "products", categorySlug);
    await ensureDir(outDir);

    const colorImages = {};
    const sources = [];

    const primaryVariant = (product.image_variants && product.image_variants[0]) || null;
    const fileName = `${safeFilePart(product.slug)}.jpg`;
    const outPath = path.join(outDir, fileName);
    const webPath = `/products/${categorySlug}/${fileName}`;

    const exists = await fs
      .stat(outPath)
      .then(() => true)
      .catch(() => false);

    let source = null;
    if (!exists) {
      const baseQuery = primaryVariant?.query || `${product.title} ${product.category}`;
      const searchQueries = [
        baseQuery,
        `${product.title} photo`,
        `${product.category} ${product.subcategory || ""}`.trim(),
        product.title,
      ].filter(Boolean);

      for (const q of searchQueries) {
        const candidates = await commonsSearchWithFallback(q);
        for (const candidate of candidates) {
          try {
            await downloadFile(candidate.imageUrl, outPath);
            source = candidate;
            break;
          } catch (err) {
            if (err?.code === "RATE_LIMITED") continue;
            throw err;
          }
        }
        if (source) break;
      }

      if (!source) throw new Error(`No usable Commons image found for: ${baseQuery}`);
      await sleep(150);
    }

    for (const color of product.colors || []) colorImages[color] = webPath;
    if (source) sources.push({ query: primaryVariant?.query || "", ...source });

    attributions.push(
      attributionLine({
        localPath: `public/products/${categorySlug}/${fileName}`,
        source: source || { extmetadata: {}, imageUrl: "" },
      })
    );

    withImages.push({
      ...product,
      category_slug: categorySlug,
      color_images: colorImages,
      sources,
    });
  }

  await writeJson("data/catalog.products.with-images.json", withImages);

  const attributionMd = `# Image Attribution\n\nSources are downloaded from Wikimedia Commons and stored locally in this repo.\n\n${attributions
    .filter(Boolean)
    .join("\n")}\n`;
  await ensureDir(path.join("public", "products"));
  await fs.writeFile(path.join("public", "products", "ATTRIBUTION.md"), attributionMd, "utf8");

  return withImages;
}

async function main() {
  await buildCategoryTileImages();
  await buildProductImages();
  console.log("Done. Wrote `data/catalog.products.with-images.json` and local images under `public/`.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
