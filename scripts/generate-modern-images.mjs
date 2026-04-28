import fs from "node:fs/promises";
import path from "node:path";
import { loadProducts, readJson, slugToCategorySlug, writeJson } from "./catalog.mjs";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hashString(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickFrom(list, seed) {
  if (!list.length) return null;
  return list[seed % list.length];
}

function safeFilePart(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function categoryPalette(categorySlug) {
  const palettes = {
    women: ["#ff5c8a", "#7c3aed", "#111827"],
    men: ["#0ea5e9", "#111827", "#22c55e"],
    kids: ["#f59e0b", "#ef4444", "#3b82f6"],
    electronics: ["#06b6d4", "#111827", "#8b5cf6"],
    "home-living": ["#10b981", "#111827", "#f59e0b"],
  };
  return palettes[categorySlug] || ["#6366f1", "#111827", "#22c55e"];
}

function iconFor(product) {
  const c = String(product.category || "");
  const s = String(product.subcategory || "");

  if (c === "Electronics") {
    if (s === "phones") return "phone";
    if (s === "computers") return "laptop";
    if (s === "audio") return "headphones";
    if (s === "wearables") return "watch";
    if (s === "cameras") return "camera";
    if (s === "network") return "router";
    return "chip";
  }

  if (c === "Home & Living") {
    if (s === "lighting") return "lamp";
    if (s === "kitchen") return "kitchen";
    if (s === "decor") return "vase";
    if (s === "bedding") return "bedding";
    if (s === "bath") return "towel";
    if (s === "storage") return "box";
    if (s === "furniture") return "chair";
    return "home";
  }

  if (c === "Kids") {
    if (s === "sets") return "set";
    if (s === "jackets") return "jacket";
    if (s === "shoes") return "shoe";
    if (s === "inners") return "socks";
    return "kids";
  }

  // Fashion
  if (s === "tops" || s === "t-shirts" || s === "shirts") return "shirt";
  if (s === "pants" || s === "trousers" || s === "jeans") return "pants";
  if (s === "hoodies") return "hoodie";
  if (s === "shoes") return "shoe";
  if (s === "jackets") return "jacket";
  if (s === "accessories") return "bag";
  return "tag";
}

function iconSvg(icon) {
  // All icons are simple, modern line icons. ViewBox 0 0 64 64
  const common = `fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.95"`;
  switch (icon) {
    case "shirt":
      return `<path ${common} d="M20 18l12-6 12 6 8 10-10 6v22H22V34l-10-6 8-10z"/>`;
    case "hoodie":
      return `<path ${common} d="M22 22c0-6 4-10 10-10s10 4 10 10v6l6 4v24H16V32l6-4v-6z"/><path ${common} d="M26 24c2 3 4 4 6 4s4-1 6-4"/>`;
    case "pants":
      return `<path ${common} d="M24 12h16l4 44H36l-4-22-4 22H20l4-44z"/>`;
    case "shoe":
      return `<path ${common} d="M14 40c6 6 14 10 24 10h12v6H14v-6c0-4 0-7 0-10z"/><path ${common} d="M14 40c6 0 12-4 16-12l10 10"/>`;
    case "jacket":
      return `<path ${common} d="M22 14l10-4 10 4 8 12-8 6v24H22V32l-8-6 8-12z"/><path ${common} d="M32 10v46"/>`;
    case "bag":
      return `<path ${common} d="M20 24h24l4 28H16l4-28z"/><path ${common} d="M24 24c0-6 4-10 8-10s8 4 8 10"/>`;
    case "earrings":
      return `<circle ${common} cx="22" cy="30" r="8"/><circle ${common} cx="42" cy="30" r="8"/>`;
    case "phone":
      return `<rect ${common} x="22" y="10" width="20" height="44" rx="5"/><path ${common} d="M28 16h8"/><path ${common} d="M32 48h0"/>`;
    case "laptop":
      return `<rect ${common} x="18" y="14" width="28" height="24" rx="3"/><path ${common} d="M12 42h40l-3 8H15l-3-8z"/>`;
    case "headphones":
      return `<path ${common} d="M18 34v10a6 6 0 0 0 6 6h2V30h-2a6 6 0 0 0-6 6z"/><path ${common} d="M46 34v10a6 6 0 0 1-6 6h-2V30h2a6 6 0 0 1 6 6z"/><path ${common} d="M20 30a12 12 0 0 1 24 0"/>`;
    case "watch":
      return `<rect ${common} x="22" y="18" width="20" height="28" rx="6"/><path ${common} d="M26 18l-2-6h16l-2 6"/><path ${common} d="M26 46l-2 6h16l-2-6"/>`;
    case "camera":
      return `<path ${common} d="M18 22h6l4-6h8l4 6h6v28H18V22z"/><circle ${common} cx="32" cy="36" r="8"/>`;
    case "router":
      return `<path ${common} d="M18 40h28v10H18V40z"/><path ${common} d="M24 40v-6"/><path ${common} d="M40 40v-6"/><path ${common} d="M24 28c4-4 12-4 16 0"/><path ${common} d="M28 32c2-2 6-2 8 0"/>`;
    case "chip":
      return `<rect ${common} x="22" y="22" width="20" height="20" rx="3"/><path ${common} d="M32 14v8"/><path ${common} d="M32 42v8"/><path ${common} d="M14 32h8"/><path ${common} d="M42 32h8"/>`;
    case "lamp":
      return `<path ${common} d="M26 18h12l6 14H20l6-14z"/><path ${common} d="M32 32v16"/><path ${common} d="M22 52h20"/>`;
    case "vase":
      return `<path ${common} d="M26 14h12c0 6-3 8-3 10s5 6 5 14c0 10-6 16-8 16s-8-6-8-16c0-8 5-12 5-14s-3-4-3-10z"/>`;
    case "kitchen":
      return `<path ${common} d="M22 18h20"/><path ${common} d="M26 18v34"/><path ${common} d="M38 18v34"/><path ${common} d="M20 52h24"/>`;
    case "bedding":
      return `<path ${common} d="M18 28h28v22H18V28z"/><path ${common} d="M18 34h28"/><path ${common} d="M24 28v6"/><path ${common} d="M40 28v6"/>`;
    case "towel":
      return `<path ${common} d="M24 16h16v40H24V16z"/><path ${common} d="M28 22h8"/>`;
    case "box":
      return `<path ${common} d="M18 26h28v28H18V26z"/><path ${common} d="M18 34h28"/><path ${common} d="M28 26v8"/>`;
    case "chair":
      return `<path ${common} d="M22 18h20v16H22V18z"/><path ${common} d="M20 34h24v10H20V34z"/><path ${common} d="M24 44v10"/><path ${common} d="M40 44v10"/>`;
    case "home":
      return `<path ${common} d="M16 34l16-14 16 14v18H16V34z"/><path ${common} d="M28 52V36h8v16"/>`;
    case "set":
      return `<path ${common} d="M18 20l8-4 8 4 8-4 8 8-8 4v24H18V28l-8-4 8-8z"/><path ${common} d="M26 28h12"/>`;
    case "socks":
      return `<path ${common} d="M28 14v18c0 6-4 10-10 10h-2v10h10c8 0 14-6 14-14V14h-12z"/>`;
    case "kids":
      return `<circle ${common} cx="32" cy="22" r="8"/><path ${common} d="M18 54c2-12 10-18 14-18s12 6 14 18"/>`;
    default:
      return `<path ${common} d="M18 24h28v28H18V24z"/><path ${common} d="M22 20h20"/>`;
  }
}

function makeSvg({ title, categorySlug, accentA, accentB, icon, seed }) {
  const angle = (seed % 40) - 20;
  const glow = clamp((seed % 90) + 30, 40, 110);
  const label = String(title || "").slice(0, 18);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1220"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
    <linearGradient id="acc" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${accentA}"/>
      <stop offset="1" stop-color="${accentB}"/>
    </linearGradient>
    <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="18" result="blur"/>
      <feColorMatrix in="blur" type="matrix"
        values="1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 0.55 0" result="glow"/>
      <feMerge>
        <feMergeNode in="glow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <rect width="1200" height="900" rx="56" fill="url(#bg)"/>

  <g transform="translate(80 90) rotate(${angle} 520 340)" opacity="0.95" filter="url(#softGlow)">
    <rect x="40" y="40" width="920" height="600" rx="56" fill="url(#acc)" opacity="0.16"/>
    <rect x="0" y="0" width="920" height="600" rx="56" fill="url(#acc)" opacity="0.12"/>
    <circle cx="760" cy="120" r="${glow}" fill="${accentA}" opacity="0.16"/>
    <circle cx="160" cy="520" r="${Math.floor(glow * 0.75)}" fill="${accentB}" opacity="0.14"/>
  </g>

  <g transform="translate(96 108)">
    <text x="0" y="36" fill="rgba(255,255,255,0.62)" font-family="system-ui, Segoe UI, Inter, sans-serif" font-size="18" letter-spacing="5">
      ${categorySlug.toUpperCase()}
    </text>
    <text x="0" y="88" fill="white" font-family="system-ui, Segoe UI, Inter, sans-serif" font-size="54" font-weight="800">
      ${escapeXml(label)}
    </text>
  </g>

  <g transform="translate(740 250)">
    <rect x="-24" y="-24" width="320" height="320" rx="56" fill="url(#acc)" opacity="0.22"/>
    <rect x="0" y="0" width="272" height="272" rx="52" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)"/>
    <g transform="translate(72 64) scale(2.0)">
      ${iconSvg(icon)}
    </g>
  </g>

  <g transform="translate(96 780)">
    <rect width="460" height="54" rx="18" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.14)"/>
    <text x="20" y="36" fill="rgba(255,255,255,0.85)" font-family="system-ui, Segoe UI, Inter, sans-serif" font-size="20">
      Q-Commerce Catalog
    </text>
  </g>
</svg>`;
}

function escapeXml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeSvg(filePath, svg) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, svg, "utf8");
}

async function main() {
  const products = await loadProducts();

  // Generate product images (SVG) and update catalog with stable local paths
  const withImages = [];
  for (const product of products) {
    const categorySlug = slugToCategorySlug(product.category);
    const seed = hashString(`${product.slug}:${categorySlug}`);
    const palette = categoryPalette(categorySlug);
    const accentA = pickFrom(palette, seed);
    const accentB = pickFrom(palette, seed >> 4) || palette[1];

    const icon = iconFor(product);
    const svg = makeSvg({
      title: product.title,
      categorySlug,
      accentA,
      accentB,
      icon,
      seed,
    });

    const outDir = path.join("public", "products", categorySlug);
    const fileName = `${safeFilePart(product.slug)}.svg`;
    const outPath = path.join(outDir, fileName);
    const webPath = `/products/${categorySlug}/${fileName}`;

    await writeSvg(outPath, svg);

    const colorImages = {};
    for (const color of product.colors || []) colorImages[color] = webPath;

    withImages.push({
      ...product,
      category_slug: categorySlug,
      color_images: colorImages,
      sources: [
        {
          provider: "generated",
          title: "Generated SVG",
          license: "internal",
        },
      ],
    });
  }

  await writeJson("data/catalog.products.with-images.json", withImages);

  // Generate modern category tiles (SVG)
  const tiles = await readJson("data/category-tiles.json");
  for (const tile of tiles) {
    const categorySlug = tile.slug;
    const seed = hashString(`tile:${categorySlug}`);
    const palette = categoryPalette(categorySlug);
    const accentA = pickFrom(palette, seed);
    const accentB = pickFrom(palette, seed >> 4) || palette[1];
    const svg = makeSvg({
      title: tile.label,
      categorySlug,
      accentA,
      accentB,
      icon: iconFor({ category: tile.category, subcategory: "" }),
      seed,
    });

    await writeSvg(path.join("public", "categories", `${categorySlug}.svg`), svg);
  }

  await ensureDir(path.join("public", "products"));
  await fs.writeFile(
    path.join("public", "products", "ATTRIBUTION.md"),
    "# Image Attribution\n\nAll catalog images are generated SVG assets stored in this repo.\n",
    "utf8"
  );

  console.log("Done. Generated modern SVG images under `public/` and updated `data/catalog.products.with-images.json`.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
