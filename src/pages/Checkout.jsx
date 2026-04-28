import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCartItems, clearCart } from "../lib/store/cartStore";
import { addOrder } from "../lib/store/ordersStore";
import { getAllProducts } from "../lib/store/productsStore";
import { createPageUrl } from "../lib/pages";
import { useAuth } from "../context/AuthContext";

function getImage(product, color) {
  if (!product?.color_images) return "";
  if (color && product.color_images[color]) return product.color_images[color];
  return Object.values(product.color_images)[0] || "";
}

export default function Checkout() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [items] = useState(() => getCartItems());
  const [detailedItems, setDetailedItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [itemsError, setItemsError] = useState("");
  const [placedOrder, setPlacedOrder] = useState(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (user?.email) {
      setEmail((prev) => prev || user.email);
    }
  }, [user?.email]);

  useEffect(() => {
    let mounted = true;
    setLoadingItems(true);
    setItemsError("");
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
        setItemsError("Unable to load product details.");
      })
      .finally(() => {
        if (mounted) setLoadingItems(false);
      });
    return () => {
      mounted = false;
    };
  }, [items]);

  const subtotal = detailedItems.reduce((sum, entry) => {
    const price = Number(entry.price ?? entry.product?.price ?? 0);
    const quantity = Number(entry.quantity || 0);
    return sum + price * quantity;
  }, 0);

  const shipping = detailedItems.length ? 3 : 0;
  const total = subtotal + shipping;

  async function handlePlaceOrder(event) {
    event.preventDefault();
    setSubmitError("");

    if (!user?.id) {
      setSubmitError("You need to be logged in to place an order.");
      return;
    }

    if (!detailedItems.length) {
      setSubmitError("Your cart is empty.");
      return;
    }

    if (detailedItems.some((entry) => !entry.product)) {
      setSubmitError("Unable to place order because product details could not be loaded.");
      return;
    }

    if (!name.trim() || !email.trim() || !address.trim()) {
      setSubmitError("Please complete name, email and address.");
      return;
    }

    setSubmitting(true);

    try {
      const createdOrder = await addOrder({
        userId: user.id,
        items: detailedItems,
        subtotal,
        shipping,
        total,
        customer: {
          name: name.trim(),
          email: email.trim(),
          address: address.trim(),
        },
      });

      clearCart();
      setPlacedOrder(createdOrder);
    } catch (error) {
      console.error("Checkout failed:", error);
      setSubmitError(error?.message || "Unable to place order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (placedOrder) {
    return (
      <div className="container">
        <div className="section">
          <div className="sectionHead">
            <h2 className="h2">Order confirmed</h2>
            <p className="p">Your order has been placed and saved to your account.</p>
            <p className="p">Order ID: {placedOrder.id}</p>
          </div>

          <div className="row" style={{ justifyContent: "flex-start" }}>
            <button className="btnPrimary" onClick={() => navigate(createPageUrl("Orders"))}>
              View orders
            </button>
            <button className="btn" onClick={() => navigate(createPageUrl("Home"))}>
              Continue shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="section">
        <div className="sectionHead">
          <h1 className="h1 thinTitle">Checkout</h1>
          <p className="p">Enter your details to place the order.</p>
        </div>

        {loadingItems ? (
          <div className="card">
            <p className="p">Loading cart items...</p>
          </div>
        ) : itemsError ? (
          <div className="card">
            <p className="p">{itemsError}</p>
          </div>
        ) : detailedItems.length ? (
          <div className="cartGrid">
            <div className="cartList">
              {detailedItems.map((entry) => (
                <div key={`${entry.productId}-${entry.color}-${entry.size}`} className="cartItem">
                  <div
                    className="cartThumb"
                    style={
                      entry.product
                        ? { backgroundImage: `url(${getImage(entry.product, entry.color)})` }
                        : undefined
                    }
                  />
                  <div className="cartInfo">
                    <strong>{entry.title || entry.product?.title || "Item"}</strong>
                    <p className="p">
                      {entry.color}
                      {entry.size ? ` - ${entry.size}` : ""}
                    </p>
                    <p className="p">Qty: {entry.quantity}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="cartSummary">
              <form className="card checkoutSummary" onSubmit={handlePlaceOrder}>
                <label className="label" htmlFor="checkout-name">Full name</label>
                <input
                  id="checkout-name"
                  className="input inputLight"
                  placeholder="Full name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />

                <label className="label" htmlFor="checkout-email">Email</label>
                <input
                  id="checkout-email"
                  className="input inputLight"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />

                <label className="label" htmlFor="checkout-address">Delivery address</label>
                <input
                  id="checkout-address"
                  className="input inputLight"
                  placeholder="Street, city, postcode"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  required
                />

                <p className="p">Subtotal: GBP {subtotal.toFixed(2)}</p>
                <p className="p">Shipping: GBP {shipping.toFixed(2)}</p>
                <p className="p">
                  <strong>Total: GBP {total.toFixed(2)}</strong>
                </p>

                {submitError ? <p className="p">{submitError}</p> : null}

                <button className="btnPrimary" type="submit" disabled={submitting}>
                  {submitting ? "Placing order..." : "Place order"}
                </button>
              </form>
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
