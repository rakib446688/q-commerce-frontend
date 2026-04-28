import { useEffect, useMemo, useRef, useState } from "react";
import { addToCart } from "../lib/store/cartStore";
import { recordAddToCart, recordProductView } from "../lib/store/trendingStore";
import { formatPrice, getColorImage, getInitialColor, getSwatchColor } from "../lib/productUi";

export default function QuickViewModal({
  open,
  product,
  initialColor,
  onClose,
  onAdded,
  onWishlist,
}) {
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const closeRef = useRef(null);
  const lastFocused = useRef(null);
  const titleId = "qvTitle";

  useEffect(() => {
    if (!product) return;
    const nextColor = initialColor || getInitialColor(product);
    setSelectedColor(nextColor);
    setSelectedSize("");
    setToast("");
  }, [product, initialColor]);

  useEffect(() => {
    if (!open) return;
    lastFocused.current = document.activeElement;
    closeRef.current?.focus();
    function onKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      if (lastFocused.current && typeof lastFocused.current.focus === "function") {
        lastFocused.current.focus();
      }
    };
  }, [open, onClose]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    if (open && product?.id) recordProductView(product.id);
  }, [open, product]);

  const imageUrl = useMemo(() => getColorImage(product, selectedColor), [product, selectedColor]);
  const requireSize = product?.sizes?.length > 0;
  const stockQty = useMemo(() => {
    const num = Number(product?.stock_qty);
    return Number.isFinite(num) ? num : null;
  }, [product?.stock_qty]);
  const isOutOfStock = stockQty !== null ? stockQty <= 0 : false;

  if (!open || !product) return null;

  function handleAddToCart() {
    if (isOutOfStock) {
      setToast("Sorry, this item is out of stock.");
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(""), 2000);
      return;
    }
    if (requireSize && !selectedSize) {
      setToast("Please select a size.");
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(""), 2000);
      return;
    }
    addToCart({
      productId: product.id,
      title: product.title,
      price: Number(product.price) || 0,
      color: selectedColor,
      size: selectedSize || "",
      quantity: 1,
    });
    recordAddToCart(product.id);
    onAdded?.();
    onClose?.();
  }

  return (
    <div
      className="modalOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className="modalCard">
        <button className="btn modalClose" type="button" onClick={onClose} ref={closeRef}>
          Close
        </button>
        <div className="modalBody">
          <div className="modalMedia" style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined} />
          <div className="modalInfo">
            <h3 className="h2" id={titleId}>
              {product.title}
            </h3>
            <p className="p">{product.description}</p>
            <div className="priceRow">
              <div className="price">
                <strong>{formatPrice(product)}</strong>
              </div>
              <span className="muted">{product.brand || "In stock"}</span>
            </div>
            {stockQty !== null ? (
              <p className="p" style={{ marginTop: 8 }}>
                <strong>Stock:</strong> {stockQty > 0 ? `${stockQty} available` : "Out of stock"}
              </p>
            ) : null}

            {product.colors?.length ? (
              <div>
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

            {product.sizes?.length ? (
              <div>
                <p className="p">Size</p>
                <div className="sizeRow">
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      className={`sizeChip sw ${selectedSize === size ? "active" : ""}`}
                      type="button"
                      aria-label={`Size: ${size}`}
                      onClick={() => setSelectedSize(size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {toast ? <div className="toast">{toast}</div> : null}

            <div className="row" style={{ justifyContent: "flex-start" }}>
              <button className="btnPrimary" type="button" onClick={handleAddToCart} disabled={isOutOfStock}>
                Add to cart
              </button>
              {onWishlist ? (
                <button className="btn" type="button" onClick={() => onWishlist(product)}>
                  Wishlist
                </button>
              ) : null}
              <button className="btn" type="button" onClick={onClose}>
                Keep shopping
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
