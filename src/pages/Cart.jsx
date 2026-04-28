import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCartItems, removeFromCart, updateCartQuantity } from "../lib/store/cartStore";
import { getAllProducts } from "../lib/store/productsStore";
import { createPageUrl } from "../lib/pages";

function getImage(product, color) {
  if (!product?.color_images) return "";
  if (color && product.color_images[color]) return product.color_images[color];
  return Object.values(product.color_images)[0] || "";
}

export default function Cart() {
  const [items, setItems] = useState(() => getCartItems());
  const [detailedItems, setDetailedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    getAllProducts()
      .then((products) => {
        if (!mounted) return;
        const byId = new Map();
        products.forEach((product) => {
          if (product.id) byId.set(product.id, product);
          if (product.legacy_id) byId.set(product.legacy_id, product);
        });
        setDetailedItems(
          items.map((entry) => ({
            ...entry,
            product: byId.get(entry.productId) || null,
          }))
        );
      })
      .catch((err) => {
        if (!mounted) return;
        console.error("Failed to load products:", err);
        setDetailedItems(items.map((entry) => ({ ...entry, product: null })));
        setError("Unable to load product details.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [items]);

  const subtotal = detailedItems.reduce((sum, entry) => sum + entry.price * entry.quantity, 0);
  const shipping = detailedItems.length ? 3 : 0;
  const total = subtotal + shipping;

  function handleRemove(entry) {
    const next = removeFromCart(entry.productId, entry.color, entry.size);
    setItems(next);
  }

  function handleQuantityChange(entry, nextQty) {
    const rawStock = Number(entry.product?.stock_qty);
    const maxQty = Number.isFinite(rawStock) ? Math.max(1, Math.floor(rawStock)) : null;
    const wanted = Math.max(1, Number(nextQty) || 1);
    const clamped = maxQty !== null ? Math.min(wanted, maxQty) : wanted;
    const next = updateCartQuantity(entry.productId, entry.color, entry.size, clamped);
    setItems(next);
  }

  return (
    <div className="container">
        <div className="section">
          <div className="sectionHead">
            <h1 className="h1 thinTitle">Shopping Bag</h1>
          </div>

        {loading ? (
          <div className="card">
            <p className="p">Loading cart items...</p>
          </div>
        ) : error ? (
          <div className="card">
            <p className="p">{error}</p>
          </div>
        ) : detailedItems.length ? (
          <div className="cartGrid">
            <div className="cartList">
              {detailedItems.map((entry) => (
                <div key={`${entry.productId}-${entry.color}-${entry.size}`} className="cartItem">
                  <div
                    className="cartThumb"
                    style={entry.product ? { backgroundImage: `url(${getImage(entry.product, entry.color)})` } : undefined}
                  />
                  <div className="cartInfo">
                    <strong>{entry.title}</strong>
                    <p className="p">{entry.color}{entry.size ? ` - ${entry.size}` : ""}</p>
                    <p className="p">GBP {entry.price.toFixed(2)}</p>
                    {Number.isFinite(Number(entry.product?.stock_qty)) ? (
                      <p className="p muted">Stock: {Number(entry.product?.stock_qty) > 0 ? entry.product.stock_qty : "Out of stock"}</p>
                    ) : null}
                    <div className="row" style={{ justifyContent: "flex-start" }}>
                      <button className="btn" onClick={() => handleQuantityChange(entry, entry.quantity - 1)}>-</button>
                      <span>{entry.quantity}</span>
                      <button className="btn" onClick={() => handleQuantityChange(entry, entry.quantity + 1)}>+</button>
                      <button className="btn" onClick={() => handleRemove(entry)}>Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="cartSummary">
              <div className="card">
                <p className="p">Subtotal: GBP {subtotal.toFixed(2)}</p>
                <p className="p">Shipping: GBP {shipping.toFixed(2)}</p>
                <p className="p"><strong>Total: GBP {total.toFixed(2)}</strong></p>
                <button className="btnPrimary" onClick={() => navigate(createPageUrl("Checkout"))}>
                  Proceed to checkout
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="card">
            <p className="p">Your cart is empty.</p>
            <button className="btn" onClick={() => navigate(createPageUrl("Home"))}>
              Continue shopping
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
