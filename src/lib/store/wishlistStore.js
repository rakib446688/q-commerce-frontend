const WISHLIST_KEY = "q_wishlist";

function getUserKey() {
  const userId = localStorage.getItem("q_user_id") || "guest";
  return `${WISHLIST_KEY}_${userId}`;
}

function loadWishlist() {
  try {
    const raw = localStorage.getItem(getUserKey());
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveWishlist(items) {
  localStorage.setItem(getUserKey(), JSON.stringify(items));
}

export function getWishlistItems() {
  return loadWishlist();
}

export function addToWishlist(productId) {
  const items = loadWishlist();
  if (!items.includes(productId)) items.push(productId);
  saveWishlist(items);
  return items;
}

export function removeFromWishlist(productId) {
  const items = loadWishlist().filter((id) => id !== productId);
  saveWishlist(items);
  return items;
}

export function toggleWishlist(productId) {
  const items = loadWishlist();
  if (items.includes(productId)) {
    return removeFromWishlist(productId);
  }
  return addToWishlist(productId);
}
