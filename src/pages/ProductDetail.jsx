import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { addToCart } from "../lib/store/cartStore";
import { getProductById } from "../lib/store/productsStore";
import { addToWishlist, getWishlistItems, removeFromWishlist } from "../lib/store/wishlistStore";
import { recordAddToCart, recordAddToWishlist, recordProductView } from "../lib/store/trendingStore";
import { createPageUrl } from "../lib/pages";
import { formatPrice, getColorImage, getInitialColor, getSwatchColor } from "../lib/productUi";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    getProductById(id)
      .then((data) => {
        if (!mounted) return;
        if (!data) {
          setError("Product not found.");
          setProduct(null);
          return;
        }
        setProduct(data);
        setSelectedColor(getInitialColor(data));
        setSelectedSize("");
        setQuantity(1);

        recordProductView(data.id);
        const wishlistItems = getWishlistItems();
        setIsWishlisted(wishlistItems.includes(data.id));
      })
      .catch((err) => {
        if (!mounted) return;
        console.error("Failed to load product:", err);
        setError("Unable to load product details.");
        setProduct(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  const imageUrl = useMemo(() => getColorImage(product, selectedColor), [product, selectedColor]);
  const requireSize = (product?.sizes?.length || 0) > 0;
  const stockQty = useMemo(() => {
    const num = Number(product?.stock_qty);
    return Number.isFinite(num) ? num : null;
  }, [product?.stock_qty]);
  const isOutOfStock = stockQty !== null ? stockQty <= 0 : false;
  const maxQty = stockQty !== null ? Math.max(1, Math.floor(stockQty)) : 99;

  function clampQty(next) {
    const wanted = Math.floor(Number(next) || 1);
    return Math.max(1, Math.min(maxQty, wanted));
  }

  function showToast(message) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2500);
  }

  function handleAddToCart() {
    if (!product) return;
    if (isOutOfStock) {
      showToast("Sorry, this item is out of stock.");
      return;
    }
    if (requireSize && !selectedSize) {
      showToast("Please select a size.");
      return;
    }

    addToCart({
      productId: product.id,
      title: product.title,
      price: Number(product.price) || 0,
      color: selectedColor,
      size: selectedSize || "",
      quantity: clampQty(quantity),
    });

    recordAddToCart(product.id);
    showToast("Added to cart.");
  }

  function handleToggleWishlist() {
    if (!product?.id) return;

    if (isWishlisted) {
      removeFromWishlist(product.id);
      setIsWishlisted(false);
      showToast("Removed from wishlist.");
      return;
    }

    addToWishlist(product.id);
    recordAddToWishlist(product.id);
    setIsWishlisted(true);
    showToast("Added to wishlist.");
  }

  if (loading) {
    return (
      <div className="container">
        <div className="section">
          <p className="p">Loading product...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container">
        <div className="section">
          <div className="card">
            <p className="p">{error || "Product not found."}</p>
            <Link to={createPageUrl("Shop")} className="btnPrimary">
              Back to Shop
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="section">
        <div className="sectionHead">
          <Link to={createPageUrl("Shop")} className="btnGhost focus" style={{ width: "fit-content" }}>
            ← Back
          </Link>
        </div>

        <div className="modalBody" style={{ alignItems: "start" }}>
          <div>
            <div className="modalMedia" style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined} />

            {product.colors?.length ? (
              <div style={{ marginTop: 14 }}>
                <p className="p">Color</p>
                <div className="colorRow">
                  {product.colors.map((color) => (
                    <button
                      key={color}
                      className={`colorSwatch sw ${selectedColor === color ? "active" : ""}`}
                      type="button"
                      aria-label={`Colour: ${color}`}
                      style={{ backgroundColor: getSwatchColor(color) }}
                      onClick={() => setSelectedColor(color)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div>
            <h1 className="h2" style={{ margin: 0 }}>
              {product.title}
            </h1>
            <p className="p" style={{ marginTop: 6 }}>
              {(product.brand || "Q").toUpperCase()}
            </p>

            <div style={{ marginTop: 10, fontSize: 22, fontWeight: 800 }}>{formatPrice(product)}</div>
            {stockQty !== null ? (
              <p className="p" style={{ marginTop: 8 }}>
                <strong>Stock:</strong> {stockQty > 0 ? `${stockQty} available` : "Out of stock"}
              </p>
            ) : null}

            {Number(product.rating_count || 0) > 0 ? (
              <p className="p" style={{ marginTop: 8 }}>
                ★ {Number(product.rating_avg || 0).toFixed(1)} ({Number(product.rating_count || 0)})
              </p>
            ) : null}

            <p className="p" style={{ marginTop: 14 }}>
              <strong>Category:</strong> {product.category}
              {product.subcategory ? ` · ${product.subcategory}` : ""}
            </p>

            {product.description ? (
              <p className="p" style={{ marginTop: 14 }}>
                {product.description}
              </p>
            ) : null}

            {product.sizes?.length ? (
              <div style={{ marginTop: 14 }}>
                <p className="p">Size{requireSize ? " *" : ""}</p>
                <div className="sizeRow">
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      className={`sizeChip sw ${selectedSize === size ? "active" : ""}`}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div style={{ marginTop: 14 }}>
              <p className="p">Quantity</p>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button className="btn" type="button" onClick={() => setQuantity((q) => clampQty(q - 1))} disabled={isOutOfStock}>
                  −
                </button>
                <strong style={{ minWidth: 40, textAlign: "center" }}>{quantity}</strong>
                <button className="btn" type="button" onClick={() => setQuantity((q) => clampQty(q + 1))} disabled={isOutOfStock}>
                  +
                </button>
              </div>
            </div>

            <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btnPrimary" type="button" onClick={handleAddToCart} disabled={isOutOfStock}>
                Add to cart
              </button>
              <button className="btnGhost" type="button" onClick={handleToggleWishlist}>
                {isWishlisted ? "Saved" : "Save"}
              </button>
              <button className="btnGhost" type="button" onClick={() => navigate(createPageUrl("Cart"))}>
                View cart
              </button>
            </div>

            {toast ? (
              <div className="toast" style={{ marginTop: 12 }}>
                {toast}
              </div>
            ) : null}

            <p className="p" style={{ marginTop: 18 }}>
              ✓ Free returns within 30 days
              <br />✓ Secure checkout
              <br />✓ Fast shipping
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
