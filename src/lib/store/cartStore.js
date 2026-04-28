const CART_KEY = "q_cart";

function getUserKey() {
  const userId = localStorage.getItem("q_user_id") || "guest";
  return `${CART_KEY}_${userId}`;
}

function loadCart() {
  try {
    const raw = localStorage.getItem(getUserKey());
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveCart(items) {
  localStorage.setItem(getUserKey(), JSON.stringify(items));
}

export function getCartItems() {
  return loadCart();
}

export function addToCart(item) {
  const items = loadCart();
  const existingIndex = items.findIndex(
    (entry) =>
      entry.productId === item.productId &&
      entry.color === item.color &&
      entry.size === item.size
  );
  if (existingIndex >= 0) {
    items[existingIndex].quantity += item.quantity || 1;
  } else {
    items.push({ ...item, quantity: item.quantity || 1 });
  }
  saveCart(items);
  return items;
}

export function updateCartQuantity(productId, color, size, quantity) {
  const items = loadCart().map((entry) => ({ ...entry }));
  const next = items.map((entry) => {
    if (entry.productId === productId && entry.color === color && entry.size === size) {
      return { ...entry, quantity: Math.max(1, quantity) };
    }
    return entry;
  });
  saveCart(next);
  return next;
}

export function removeFromCart(productId, color, size) {
  const items = loadCart().filter(
    (entry) =>
      entry.productId !== productId || entry.color !== color || entry.size !== size
  );
  saveCart(items);
  return items;
}

export function clearCart() {
  saveCart([]);
  return [];
}
