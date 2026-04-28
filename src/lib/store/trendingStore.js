const TRENDING_KEY = "q_trending_metrics";

function getUserKey() {
  const userId = localStorage.getItem("q_user_id") || "guest";
  return `${TRENDING_KEY}_${userId}`;
}

function loadMetrics() {
  try {
    const raw = localStorage.getItem(getUserKey());
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function saveMetrics(metrics) {
  localStorage.setItem(getUserKey(), JSON.stringify(metrics));
}

function increment(productId, amount) {
  if (!productId) return;
  const metrics = loadMetrics();
  const current = Number(metrics[productId] || 0);
  metrics[productId] = current + amount;
  saveMetrics(metrics);
}

export function recordProductView(productId) {
  increment(productId, 1);
}

export function recordAddToCart(productId) {
  increment(productId, 3);
}

export function recordAddToWishlist(productId) {
  increment(productId, 2);
}

export function getTrendingProducts(products, count = 12) {
  const metrics = loadMetrics();
  const scored = products
    .map((product) => ({
      product,
      score: Number(metrics[product.id] || 0),
    }))
    .sort((a, b) => b.score - a.score);

  return scored.filter((item) => item.score > 0).slice(0, count).map((item) => item.product);
}
