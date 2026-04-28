import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getWishlistItems, removeFromWishlist } from "../lib/store/wishlistStore";
import { getAllProducts } from "../lib/store/productsStore";
import { createPageUrl } from "../lib/pages";
import ProductCard from "../components/ProductCard";
import QuickViewModal from "../components/QuickViewModal";

export default function Wishlist() {
  const [items, setItems] = useState(() => getWishlistItems());
  const [quickView, setQuickView] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    getAllProducts()
      .then((allProducts) => {
        if (!mounted) return;
        const byId = new Map();
        allProducts.forEach((product) => {
          if (product.id) byId.set(product.id, product);
          if (product.legacy_id) byId.set(product.legacy_id, product);
        });
        setProducts(items.map((id) => byId.get(id)).filter(Boolean));
      })
      .catch((err) => {
        if (!mounted) return;
        console.error("Failed to load products:", err);
        setProducts([]);
        setError("Unable to load wishlist items.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [items]);

  if (loading) {
    return (
      <div className="container">
        <div className="section">
          <h2 className="h2 thinTitle">Wishlist</h2>
          <div className="card">
            <p className="p">Loading wishlist...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !products.length) {
    return (
      <div className="container">
        <div className="section">
          <h2 className="h2 thinTitle">Wishlist</h2>
          <div className="emptyState">
            <div className="emptyIcon">?</div>
            <p className="p">{error || "Your wishlist is empty"}</p>
            <Link className="btnPrimary" to={createPageUrl("Shop")}>
              Discover Products
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
          <h2 className="h2 thinTitle">Wishlist</h2>
        </div>
        <div className="pGrid">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isTrending={false}
              onQuickView={(item, color) => setQuickView({ product: item, color })}
              onWishlist={() => setItems(removeFromWishlist(product.id))}
              wishlistLabel="Remove"
            />
          ))}
        </div>
      </div>

      <QuickViewModal
        open={Boolean(quickView)}
        product={quickView?.product}
        initialColor={quickView?.color}
        onClose={() => setQuickView(null)}
      />
    </div>
  );
}
