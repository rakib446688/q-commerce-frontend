import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createPageUrl } from "../lib/pages";
import { getRecommendations } from "../lib/recommendationsApi";
import { getAllProducts } from "../lib/store/productsStore";
import { getTrendingProducts, recordAddToWishlist } from "../lib/store/trendingStore";
import { getCartItems } from "../lib/store/cartStore";
import { addToWishlist } from "../lib/store/wishlistStore";
import ProductCard from "../components/ProductCard";
import QuickViewModal from "../components/QuickViewModal";
import CategoryTiles from "../components/CategoryTiles";
import ProductRail from "../components/ProductRail";

const sections = [
  { id: "home", label: "Home" },
  { id: "categories", label: "Categories" },
  { id: "trending", label: "Trending" },
  { id: "shop", label: "Shop" },
];

const HERO_IMAGES = [
  "/8.jpg",
  "/9.jpg",
  "/10.jpg",
  "/11.jpg",
  "/12.jpg",
];

const HERO_INTERVAL_MS = 2000;

const MotionDiv = motion.div;

function scrollToId(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function useActiveSection(ids) {
  const [active, setActive] = useState(ids[0] ?? "home");

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0))[0];
        if (visible?.target?.id) setActive(visible.target.id);
      },
      { threshold: [0.15, 0.25, 0.35], rootMargin: "-25% 0px -55% 0px" }
    );

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });

    return () => obs.disconnect();
  }, [ids]);

  return active;
}

function Reveal({ children, delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.22, once: true });

  return (
    <MotionDiv
      ref={ref}
      initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
      animate={inView ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: 18, filter: "blur(8px)" }}
      transition={{ duration: 0.55, ease: "easeOut", delay }}
    >
      {children}
    </MotionDiv>
  );
}

export default function Home() {
  const [theme, setTheme] = useState("dark");
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [query, setQuery] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationsQuery, setRecommendationsQuery] = useState("");
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const [heroIndex, setHeroIndex] = useState(0);
  const [quickView, setQuickView] = useState(null);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const refreshCartCount = useCallback(() => {
    const items = getCartItems();
    const total = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    setCartCount(total);
  }, []);

  const active = useActiveSection(sections.map((s) => s.id));

  useEffect(() => {
    document.body.classList.toggle("light", theme === "light");
  }, [theme]);

  useEffect(() => {
    if (!HERO_IMAGES.length) return;
    const intervalId = window.setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % HERO_IMAGES.length);
    }, HERO_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let mounted = true;
    setProductsLoading(true);
    setProductsError("");
    getAllProducts()
      .then((data) => {
        if (!mounted) return;
        setProducts(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        if (!mounted) return;
        console.error("Failed to load products:", error);
        setProducts([]);
        setProductsError("Unable to load products right now.");
      })
      .finally(() => {
        if (mounted) setProductsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    refreshCartCount();
  }, [refreshCartCount]);

  async function handleLogout() {
    await logout();
  }

  const allProducts = products;
  const trendingProducts = useMemo(() => getTrendingProducts(allProducts, 12), [allProducts]);
  const trendingIds = useMemo(() => new Set(trendingProducts.map((product) => product.id)), [trendingProducts]);
  const qPicks = useMemo(() => allProducts.slice(0, 8), [allProducts]);
  const newArrivals = useMemo(() => allProducts.slice(4, 16), [allProducts]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allProducts;
    return allProducts.filter((p) => p.title.toLowerCase().includes(q) || (p.brand ?? "").toLowerCase().includes(q));
  }, [query, allProducts]);

  const recommendedItems = useMemo(() => {
    if (!Array.isArray(recommendations) || !recommendations.length) return [];
    const bySlug = new Map(allProducts.map((product) => [product.slug, product]));
    return recommendations
      .map((item) => ({
        product: bySlug.get(String(item?.slug || "").trim()) || null,
        reason: String(item?.reason || "").trim(),
      }))
      .filter((item) => item.product);
  }, [recommendations, allProducts]);

  function goToCart() {
    navigate(createPageUrl("Cart"));
  }

  function goToAccount() {
    navigate(createPageUrl("Account"));
  }

  function goToWishlist() {
    navigate(createPageUrl("Wishlist"));
  }

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
      setRecommendationsQuery(query);
    } catch (error) {
      console.error("Failed to fetch recommendations:", error);
      setRecommendations([]);
      setRecommendationsQuery(query);
      setRecommendationsError(error?.message || "Unable to get recommendations right now.");
    } finally {
      setRecommendationsLoading(false);
    }
  }

  function openAssistant(open = true, prompt = "") {
    window.dispatchEvent(new CustomEvent("qcommerce:toggle-chat", { detail: { open, prompt } }));
  }

  return (
    <>
      <div className="bg" />

      <div className="header">
        <div className="headerInner">
          <button className="brand" onClick={() => scrollToId("home")} title="Back to top">
            <img
              className="brandLogo"
              src="/logo.jpg"
              alt="Q-Commerce"
              loading="lazy"
              decoding="async"
              width="40"
              height="40"
            />
            <div className="brandText">
              <strong>Q-Commerce</strong>
              <span>Fast shopping - Smart picks</span>
            </div>
          </button>

          <div className="search">
            <input
              className="searchInput"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products..."
            />
            <button className="searchBtn" onClick={() => scrollToId("shop")}>Search</button>
          </div>

          <div className="headerActions">
            <button className="ghostBtn" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            <button className="ghostBtn" onClick={handleLogout}>Logout</button>
            <button className="ghostBtn" onClick={goToWishlist}>Wishlist</button>
            <button className="ghostBtn" onClick={goToAccount}>Account</button>
            <button className="ghostBtn" onClick={() => openAssistant(true, "Hi! Help me find a product. Ask me a few quick questions then recommend 3 options.")}>Assistant</button>
            <button className="cartBtn" onClick={goToCart}>
              Cart <span className="cartPill">{cartCount}</span>
            </button>
          </div>
        </div>

        <div className="navRow">
          <div className="navShell">
            {sections.map((s) => (
              <button
                key={s.id}
                className={`pill ${active === s.id ? "pillActive" : ""}`}
                onClick={() => scrollToId(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container">
        <section id="home" className="hero">
          <div className="heroSlides" aria-hidden="true">
            {HERO_IMAGES.map((src, idx) => (
              <div
                key={src}
                className={`heroSlide ${idx === heroIndex ? "active" : ""}`}
                style={{ backgroundImage: `url(${src})` }}
              />
            ))}
          </div>
          <div className="heroOverlay">
            <h1 className="heroTitle">Shop With Q</h1>
            <div className="heroCtas">
              <Link to={createPageUrl("CategoryListing?category=Women")} className="btnGhost focus">Shop Women</Link>
              <Link to={createPageUrl("CategoryListing?category=Men")} className="btnPrimary focus">Shop Men</Link>
            </div>
          </div>
        </section>

        <section id="categories">
          <CategoryTiles />
        </section>

        <section id="trending" className="section">
          <div className="assistantBanner">
            <div>
              <div className="kicker">ASSISTANT</div>
              <h2 className="h2">Ask Q for instant picks</h2>
            </div>
            <button className="btnPrimary" type="button" onClick={() => openAssistant(true, "Recommend products for me. My budget is GBP 50 and I want something for everyday use.")}>
              Open Assistant
            </button>
          </div>
          <ProductRail
            kicker="MOST POPULAR"
            title="Trending Now"
            viewAllTo="/shop?sort=new"
            products={newArrivals}
            onQuickView={(item, color) => setQuickView({ product: item, color })}
            onWishlist={handleWishlist}
          />
          <ProductRail
            kicker="CREATED FOR YOU"
            title="Q's Picks"
            viewAllTo="/trending"
            products={qPicks}
            onQuickView={(item, color) => setQuickView({ product: item, color })}
            onWishlist={handleWishlist}
          />
        </section>

        <section className="section">
          <Reveal>
            <div className="sectionHead">
              <div className="kicker">SHOP</div>
              <h2 className="h2">Featured</h2>
              <p className="p">Curated items from across the store.</p>
            </div>
          </Reveal>
        </section>

        <section id="shop" className="section">
          <Reveal>
            <div className="sectionHead">
              <h2 className="h2">Shop</h2>
              <p className="p">Browse the full catalog.</p>
            </div>
          </Reveal>

          <Reveal delay={0.05}>
            <div className="productsTop">
              <div className="productsMeta">
                Showing <strong>{filteredProducts.length}</strong> items
                <span className="dot">-</span>
                <span className="muted">Query:</span> <strong>{query || "All"}</strong>
              </div>
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button
                  className="btn"
                  onClick={() => {
                    setQuery("");
                    setRecommendations([]);
                    setRecommendationsQuery("");
                    setRecommendationsError("");
                  }}
                >
                  Clear
                </button>
                <button
                  className="btnPrimary"
                  type="button"
                  disabled={productsLoading || recommendationsLoading}
                  onClick={fetchRecommendations}
                >
                  {recommendationsLoading ? "Getting..." : "Get recommendations"}
                </button>
              </div>
            </div>
          </Reveal>

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
                  {recommendationsQuery ? `Based on "${recommendationsQuery}"` : "Based on what's popular right now."}
                </p>
              </div>
              <div className="pGrid">
                {recommendedItems.map((item) => (
                  <ProductCard
                    key={item.product.id}
                    product={item.product}
                    isTrending={trendingIds.has(item.product.id)}
                    onQuickView={(product, color) => setQuickView({ product, color })}
                    onWishlist={handleWishlist}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {productsLoading ? (
            <div className="card">
              <p className="p">Loading products...</p>
            </div>
          ) : productsError ? (
            <div className="card">
              <p className="p">{productsError}</p>
            </div>
          ) : (
            <div className="products">
              {filteredProducts.map((product, idx) => (
                <Reveal key={product.id} delay={0.03 * Math.min(idx, 8)}>
                  <ProductCard
                    product={product}
                    isTrending={trendingIds.has(product.id)}
                    onQuickView={(item, color) => setQuickView({ product: item, color })}
                    onWishlist={handleWishlist}
                  />
                </Reveal>
              ))}
            </div>
          )}
        </section>

      </div>

      <QuickViewModal
        open={Boolean(quickView)}
        product={quickView?.product}
        initialColor={quickView?.color}
        onClose={() => setQuickView(null)}
        onAdded={refreshCartCount}
        onWishlist={handleWishlist}
      />
    </>
  );
}
