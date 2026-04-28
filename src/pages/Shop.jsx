import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { getRecommendations } from "../lib/recommendationsApi";
import { getAllProducts } from "../lib/store/productsStore";
import { addToWishlist } from "../lib/store/wishlistStore";
import { recordAddToWishlist } from "../lib/store/trendingStore";
import ProductCard from "../components/ProductCard";
import QuickViewModal from "../components/QuickViewModal";

export default function Shop() {
  const [quickView, setQuickView] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState("");
  const location = useLocation();
  const query = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return (params.get("query") || "").trim();
  }, [location.search]);

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

  useEffect(() => {
    setRecommendations([]);
    setRecommendationsError("");
  }, [query]);

  const filtered = useMemo(() => {
    if (!query) return products;
    const q = query.toLowerCase();
    return products.filter((product) => {
      const fields = [
        product.title,
        product.brand,
        product.category,
        product.subcategory,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return fields.includes(q);
    });
  }, [products, query]);

  const recommendedItems = useMemo(() => {
    if (!Array.isArray(recommendations) || !recommendations.length) return [];
    const bySlug = new Map(products.map((product) => [product.slug, product]));
    return recommendations
      .map((item) => ({
        product: bySlug.get(String(item?.slug || "").trim()) || null,
        reason: String(item?.reason || "").trim(),
      }))
      .filter((item) => item.product);
  }, [recommendations, products]);

  function handleWishlist(product) {
    if (!product?.id) return;
    addToWishlist(product.id);
    recordAddToWishlist(product.id);
  }

  async function fetchRecommendations() {
    setRecommendationsLoading(true);
    setRecommendationsError("");

    try {
      const result = await getRecommendations({ query, limit: 8 });
      setRecommendations(result.recommendations);
    } catch (err) {
      console.error("Failed to fetch recommendations:", err);
      setRecommendations([]);
      setRecommendationsError(err?.message || "Unable to get recommendations right now.");
    } finally {
      setRecommendationsLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="section">
        <div className="sectionHead">
          <h2 className="h2">Shop</h2>
          <p className="p">
            {query ? `Results for "${query}"` : "Browse the full catalog."}
          </p>
        </div>

        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btnPrimary" type="button" disabled={loading || recommendationsLoading} onClick={fetchRecommendations}>
            {recommendationsLoading ? "Getting..." : "Get recommendations"}
          </button>
        </div>

        {recommendationsError ? (
          <div className="card" style={{ marginTop: 14 }}>
            <p className="p">{recommendationsError}</p>
          </div>
        ) : recommendationsLoading ? (
          <div className="card" style={{ marginTop: 14 }}>
            <p className="p">Finding picks for you...</p>
          </div>
        ) : recommendedItems.length ? (
          <div style={{ marginTop: 18 }}>
            <div className="sectionHead">
              <div className="kicker">FOR YOU</div>
              <h2 className="h2">Recommended for you</h2>
              <p className="p">
                {query ? `Based on "${query}"` : "Based on what's popular right now."}
              </p>
            </div>
            <div className="pGrid">
              {recommendedItems.map((item) => (
                <ProductCard
                  key={item.product.id}
                  product={item.product}
                  isTrending={false}
                  onQuickView={(product, color) => setQuickView({ product, color })}
                  onWishlist={handleWishlist}
                />
              ))}
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="card">
            <p className="p">Loading products...</p>
          </div>
        ) : error ? (
          <div className="card">
            <p className="p">{error}</p>
          </div>
        ) : filtered.length ? (
          <div className="pGrid">
            {filtered.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isTrending={false}
                onQuickView={(item, color) => setQuickView({ product: item, color })}
                onWishlist={handleWishlist}
              />
            ))}
          </div>
        ) : (
          <div className="card">
            <p className="p">No products match your search.</p>
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
