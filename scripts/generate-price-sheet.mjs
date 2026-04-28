import fs from "node:fs/promises";
import { loadProducts } from "./catalog.mjs";

async function main() {
  const products = await loadProducts();
  const byCategory = new Map();
  for (const product of products) {
    const list = byCategory.get(product.category) || [];
    list.push(product);
    byCategory.set(product.category, list);
  }

  const order = ["Women", "Men", "Kids", "Electronics", "Home & Living"];
  const sections = order
    .map((category) => {
      const items = (byCategory.get(category) || []).sort((a, b) => a.slug.localeCompare(b.slug));
      const lines = items.map((p, idx) => `${idx + 1}. ${p.title} (\`${p.slug}\`) — £`);
      return `## ${category}\n${lines.join("\n")}`;
    })
    .join("\n\n");

  const md = `# Price Sheet\n\nFill the prices (GBP) after each product.\n\n${sections}\n`;
  await fs.writeFile("data/price-sheet.md", md, "utf8");
  console.log("Wrote data/price-sheet.md");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

