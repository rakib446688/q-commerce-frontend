import { useEffect, useMemo, useState } from "react";
import { getAllProducts } from "../lib/store/productsStore";
import { getTrendingProducts, recordAddToWishlist } from "../lib/store/trendingStore";
import { addToWishlist } from "../lib/store/wishlistStore";
import ProductCard from "../components/ProductCard";
import QuickViewModal from "../components/QuickViewModal";

export default function Trending() {
  const [quickView, setQuickView] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    getAllProducts()
      .then((data) => {
        if (!mounted) return;
        setProducts(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error("Failed to load products:", err);
        setProducts([]);
        setError("Unable to load products right now.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const trendingProducts = useMemo(() => getTrendingProducts(products, 12), [products]);

  function handleWishlist(product) {
    if (!product?.id) return;
    addToWishlist(product.id);
    recordAddToWishlist(product.id);
  }

  return (
    <div className="container">
      <div className="section">
        <div className="sectionHead">
          <h2 className="h2">Trending</h2>
          <p className="p">Top items based on views, wishlist adds, and cart adds.</p>
        </div>

        {loading ? (
          <div className="card">
            <p className="p">Loading products...</p>
          </div>
        ) : error ? (
          <div className="card">
            <p className="p">{error}</p>
          </div>
        ) : trendingProducts.length ? (
          <div className="pGrid">
            {trendingProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isTrending
                onQuickView={(item, color) => setQuickView({ product: item, color })}
                onWishlist={handleWishlist}
              />
            ))}
          </div>
        ) : (
          <div className="card">
            <p className="p">Interact with products to see trending items.</p>
          </div>
        )}
      </div>

      <QuickViewModal
        open={Boolean(quickView)}
        product={quickView?.product}
        initialColor={quickView?.color}
        onClose={() => setQuickView(null)}
        onWishlist={handleWishlist}
      />
    </div>
  );
}
