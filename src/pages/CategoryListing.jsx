import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { getProductsByCategory } from "../lib/store/productsStore";
import { addToWishlist } from "../lib/store/wishlistStore";
import { recordAddToWishlist } from "../lib/store/trendingStore";
import ProductCard from "../components/ProductCard";
import QuickViewModal from "../components/QuickViewModal";
import CategoryTiles from "../components/CategoryTiles";

function getParam(params, key) {
  const value = params.get(key);
  return value ? value.trim() : "";
}

export default function CategoryListing() {
  const location = useLocation();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const category = getParam(searchParams, "category");
  const subcategory = getParam(searchParams, "subcategory");
  const [selectedColor, setSelectedColor] = useState("");
  const [quickView, setQuickView] = useState(null);
  const [categoryProducts, setCategoryProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    getProductsByCategory(category, subcategory)
      .then((data) => {
        if (!mounted) return;
        setCategoryProducts(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error("Failed to load products:", err);
        setCategoryProducts([]);
        setError("Unable to load products right now.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [category, subcategory]);

  const availableColors = useMemo(() => {
    const colors = new Set();
    categoryProducts.forEach((product) => {
      product.colors?.forEach((color) => colors.add(color));
    });
    return Array.from(colors);
  }, [categoryProducts]);

  const filteredProducts = useMemo(() => {
    if (!selectedColor) return categoryProducts;
    return categoryProducts.filter((product) => product.colors?.includes(selectedColor));
  }, [categoryProducts, selectedColor]);

  function handleWishlist(product) {
    if (!product?.id) return;
    addToWishlist(product.id);
    recordAddToWishlist(product.id);
  }

  return (
    <div className="container">
      {!category ? <CategoryTiles /> : null}
      <div className="section">
        <div className="sectionHead">
          <h1 className="h2">{category || "All Products"}</h1>
          {subcategory ? <p className="p">{subcategory}</p> : null}
        </div>
        {availableColors.length ? (
          <div>
            <p className="p">Filter by color</p>
            <div className="colorRow">
              <button
                className={`sizeChip sw ${selectedColor === "" ? "active" : ""}`}
                type="button"
                onClick={() => setSelectedColor("")}
              >
                All
              </button>
              {availableColors.map((color) => (
                <button
                  key={color}
                  className={`colorSwatch sw ${selectedColor === color ? "active" : ""}`}
                  type="button"
                  aria-label={`Colour: ${color}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div className="pGrid">
        {loading ? (
          <div className="card">
            <p className="p">Loading products...</p>
          </div>
        ) : error ? (
          <div className="card">
            <p className="p">{error}</p>
          </div>
        ) : filteredProducts.length ? (
          filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isTrending={false}
              onQuickView={(item, color) => setQuickView({ product: item, color })}
              onWishlist={handleWishlist}
            />
          ))
        ) : (
          <div className="card">
            <p className="p">No items found for this selection.</p>
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
