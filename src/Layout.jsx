import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { createPageUrl } from "./lib/pages";
import { getCartItems } from "./lib/store/cartStore";
import Footer from "./components/Footer";
import ChatWidget from "./components/ChatWidget";
import { isAdminUser } from "./lib/admin";

const TOP_SECTIONS = [
  { label: "Men", category: "Men" },
  { label: "Women", category: "Women" },
  { label: "Kids", category: "Kids" },
  { label: "Electronics", category: "Electronics" },
  { label: "Home & Living", category: "Home & Living" },
];

export default function Layout() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchTerm(params.get("query") || "");
  }, [location.search]);

  useEffect(() => {
    if (!drawerOpen) return;
    function handleKey(event) {
      if (event.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [drawerOpen]);

  const cartCount = useMemo(() => {
    const items = getCartItems();
    return items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  }, [location.pathname]);

  const activeCategory = useMemo(() => {
    if (location.pathname !== createPageUrl("CategoryListing")) return "";
    const params = new URLSearchParams(location.search);
    return (params.get("category") || "").trim();
  }, [location.pathname, location.search]);

  function handleSearch() {
    const query = searchTerm.trim();
    if (!query) {
      navigate(createPageUrl("Shop"));
    } else {
      navigate(createPageUrl(`Shop?query=${encodeURIComponent(query)}`));
    }
    setSearchOpen(false);
  }

  function toggleChat(open) {
    window.dispatchEvent(new CustomEvent("qcommerce:toggle-chat", { detail: { open } }));
  }

  return (
    <div data-authenticated={user ? "true" : "false"}>
      <header className="topbar">
        <div className="topbarInner">
          <button className="iconBtn focus" type="button" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            <svg className="iconSvg" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <div className="topbarCenter">
            <button
              className="brandCenter focus"
              type="button"
              onClick={() => navigate(createPageUrl("Home"))}
              aria-label="Go to home"
              title="Home"
            >
              <img
                className="brandLogoImg"
                src="/logo.jpg"
                alt="Q-Commerce"
                width="36"
                height="36"
                loading="lazy"
                decoding="async"
              />
              <div className="brandLabel">Q-COMMERCE STORE</div>
            </button>
            <nav className="topbarNav" aria-label="Sections">
              {TOP_SECTIONS.map((section) => (
                <Link
                  key={section.category}
                  className={`topbarNavLink focus ${activeCategory === section.category ? "active" : ""}`}
                  to={createPageUrl(`CategoryListing?category=${encodeURIComponent(section.category)}`)}
                  aria-current={activeCategory === section.category ? "page" : undefined}
                >
                  {section.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="topbarActions">
            <button
              className="iconBtn focus"
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="Search"
              title="Search"
            >
              <svg className="iconSvg" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
                <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <button
              className="iconBtn focus"
              type="button"
              onClick={() => toggleChat(true)}
              aria-label="Assistant"
              title="Assistant"
            >
              <svg className="iconSvg" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" fill="currentColor" />
              </svg>
            </button>
            <button
              className="iconBtn focus"
              type="button"
              onClick={() => navigate(createPageUrl("Wishlist"))}
              aria-label="Wishlist"
              title="Wishlist"
            >
              <svg className="iconSvg" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 20l-6.5-6.5a4.5 4.5 0 0 1 6.4-6.4L12 7l.1-.1a4.5 4.5 0 0 1 6.4 6.4L12 20z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              className="iconBtn focus cartIcon"
              type="button"
              onClick={() => navigate(createPageUrl("Cart"))}
              aria-label="Cart"
              title="Cart"
            >
              <svg className="iconSvg" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 7h14l-2 9H8L6 7z" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM17 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM6 7L4 3H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {cartCount ? <span className="cartBadge">{cartCount}</span> : null}
            </button>
            <button
              className="iconBtn focus"
              type="button"
              onClick={() => navigate(createPageUrl("Account"))}
              aria-label="Account"
              title="Account"
            >
              <svg className="iconSvg" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" fill="none" />
                <path d="M4 20c1.8-3.3 5-5 8-5s6.2 1.7 8 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </header>
      {searchOpen ? (
        <div className="searchRow container">
          <input
            className="searchInput"
            placeholder="Search for products, brands, categories..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleSearch();
              }
            }}
          />
        </div>
      ) : null}
      {drawerOpen ? (
        <aside className="drawerOverlay" onClick={(event) => event.target === event.currentTarget && setDrawerOpen(false)}>
          <div className="drawer">
            <button className="btnGhost focus" type="button" onClick={() => setDrawerOpen(false)}>
              Close
            </button>
            <button className="drawerLink focus" type="button" onClick={() => navigate(createPageUrl("Home"))}>
              Home
            </button>
            <button className="drawerLink focus" type="button" onClick={() => navigate(createPageUrl("Shop"))}>
              Shop
            </button>
            <button className="drawerLink focus" type="button" onClick={() => navigate(createPageUrl("Home"))}>
              Categories
            </button>
            <button className="drawerLink focus" type="button" onClick={() => navigate(createPageUrl("Trending"))}>
              Trending
            </button>
            <button className="drawerLink focus" type="button" onClick={() => toggleChat(true)}>
              Assistant
            </button>
            <button className="drawerLink focus" type="button" onClick={() => navigate(createPageUrl("Account"))}>
              Account
            </button>
            {user && isAdminUser(user) ? (
              <button className="drawerLink focus" type="button" onClick={() => navigate(createPageUrl("Admin"))}>
                Admin
              </button>
            ) : null}
            <button className="drawerLink focus" type="button" onClick={() => navigate(createPageUrl("Orders"))}>
              Orders
            </button>
            <button className="drawerLink focus" type="button" onClick={() => navigate(createPageUrl("Wishlist"))}>
              Wishlist
            </button>
            <button className="drawerLink focus" type="button" onClick={() => navigate(createPageUrl("Cart"))}>
              Cart
            </button>
          </div>
        </aside>
      ) : null}
      <Outlet />
      <ChatWidget />
      <Footer />
    </div>
  );
}
