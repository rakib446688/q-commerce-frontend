import fs from "node:fs/promises";

export async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

export async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function slugToCategorySlug(category) {
  if (category === "Home & Living") return "home-living";
  return String(category).toLowerCase().trim();
}

export function getCatalogPaths() {
  return {
    categories: "data/catalog.categories.json",
    women: "data/catalog.products.women.json",
    men: "data/catalog.products.men.json",
    kids: "data/catalog.products.kids.json",
    electronics: "data/catalog.products.electronics.json",
    home: "data/catalog.products.home.json",
    categoryTiles: "data/category-tiles.json",
    pricesTemplate: "data/prices.template.json",
  };
}

export async function loadProducts() {
  const paths = getCatalogPaths();
  const [women, men, kids, electronics, home] = await Promise.all([
    readJson(paths.women),
    readJson(paths.men),
    readJson(paths.kids),
    readJson(paths.electronics),
    readJson(paths.home),
  ]);

  return [...women, ...men, ...kids, ...electronics, ...home];
}

