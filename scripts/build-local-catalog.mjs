import fs from "node:fs/promises";
import path from "node:path";

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

async function main() {
  const srcPath = "data/catalog.products.with-images.json";
  const products = await readJson(srcPath);
  const prices = await readJson("data/prices.json").catch(() => ({}));

  const local = (products || []).map((p) => ({
    id: p.slug,
    db_id: null,
    legacy_id: p.slug,
    slug: p.slug,
    title: p.title || "",
    category: p.category || "",
    subcategory: p.subcategory || "",
    price: toNumber(prices?.[p.slug], toNumber(p.price, 0)),
    rating_avg: toNumber(p.rating_avg, 0),
    rating_count: toNumber(p.rating_count, 0),
    colors: Array.isArray(p.colors) ? p.colors : [],
    sizes: Array.isArray(p.sizes) ? p.sizes : [],
    color_images: p.color_images || {},
    description: p.description || "",
    brand: p.brand || "",
    is_active: true,
    stock_qty: toNumber(p.stock_qty, 0),
    _localCatalog: true
  }));

  await writeJson("src/lib/catalog/productsCatalog.json", local);
  console.log("Wrote src/lib/catalog/productsCatalog.json");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
