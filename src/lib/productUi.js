const COLOR_MAP = {
  cream: "#f3efe2",
  sage: "#a3b18a",
  stone: "#c9c1b5",
  clay: "#c4a484",
  graphite: "#3a3a3a",
  midnight: "#1c2333",
  charcoal: "#36454f",
  forest: "#2f5d50",
  khaki: "#bdb193",
  navy: "#1f2a44",
  sky: "#8ab6d6",
  tan: "#c19a6b",
  rose: "#e6a4b4",
  plum: "#5e2b5f",
  mint: "#bde7d0",
  sand: "#d8c7a6",
  silver: "#c0c0c0",
  gold: "#d4af37",
  clear: "#f2f2f2",
};

export function getInitialColor(product) {
  if (product?.colors?.length) return product.colors[0];
  const keys = product?.color_images ? Object.keys(product.color_images) : [];
  return keys[0] || "";
}

export function getColorImage(product, color) {
  if (!product?.color_images) return "";
  if (color && product.color_images[color]) return product.color_images[color];
  const fallback = Object.values(product.color_images)[0];
  return fallback || "";
}

export function getSwatchColor(color) {
  return COLOR_MAP[color] || color;
}

export function formatPrice(product) {
  const price = Number(product?.price);
  if (!Number.isFinite(price) || price <= 0) return "Price TBD";
  return `£${price.toFixed(2)}`;
}

