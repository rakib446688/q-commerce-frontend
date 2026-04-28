import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { adminListProducts, adminUpdateProduct } from "../lib/adminApi";
import { isAdminUser } from "../lib/admin";

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export default function Admin() {
  const { user, session, loading } = useAuth();
  const accessToken = session?.access_token || "";
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | saving
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (!isAdminUser(user)) return;
    if (!accessToken) return;

    let mounted = true;
    setStatus("loading");
    setError("");

    adminListProducts(accessToken, { limit: 300 })
      .then((data) => {
        if (!mounted) return;
        setProducts(Array.isArray(data?.products) ? data.products : []);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err?.message || "Unable to load admin products.");
      })
      .finally(() => {
        if (!mounted) return;
        setStatus("idle");
      });

    return () => {
      mounted = false;
    };
  }, [loading, user, accessToken]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const fields = [p.title, p.slug, p.category, p.subcategory].filter(Boolean).join(" ").toLowerCase();
      return fields.includes(q);
    });
  }, [products, query]);

  async function handleUpdate(productId, patch) {
    if (!accessToken) return;
    setError("");
    setStatus("saving");
    try {
      const data = await adminUpdateProduct(accessToken, productId, patch);
      const updated = data?.product || null;
      if (updated?.id) {
        setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      }
    } catch (err) {
      setError(err?.message || "Update failed.");
    } finally {
      setStatus("idle");
    }
  }

  if (loading) {
    return (
      <div className="container">
        <div className="section">
          <p className="p">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container">
        <div className="section">
          <h1 className="h2">Admin</h1>
          <div className="card">
            <p className="p">You must be logged in.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdminUser(user)) {
    return (
      <div className="container">
        <div className="section">
          <h1 className="h2">Admin</h1>
          <div className="card">
            <p className="p">Access denied.</p>
            <p className="p muted">Add your email to VITE_ADMIN_EMAILS to enable admin access.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="section">
        <div className="sectionHead">
          <h1 className="h2">Admin</h1>
          <p className="p">Manage product visibility and stock.</p>
        </div>

        <div className="card" style={{ display: "grid", gap: 10 }}>
          <label className="label" htmlFor="admin-search">Search</label>
          <input
            id="admin-search"
            className="input"
            placeholder="Search by title, slug, category..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {error ? <p className="p" style={{ color: "#c2410c" }}>{error}</p> : null}
          <p className="p muted">
            Showing {filtered.length} of {products.length} products
            {status !== "idle" ? ` (${status})` : ""}
          </p>
        </div>

        <div className="card" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Title</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Category</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Price</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Stock</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Active</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <AdminRow
                  key={product.id}
                  product={product}
                  busy={status === "saving"}
                  onUpdate={handleUpdate}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AdminRow({ product, onUpdate, busy }) {
  const [stock, setStock] = useState(String(product.stock_qty ?? 0));
  const [active, setActive] = useState(Boolean(product.is_active));

  useEffect(() => {
    setStock(String(product.stock_qty ?? 0));
    setActive(Boolean(product.is_active));
  }, [product.id, product.stock_qty, product.is_active]);

  const dirty =
    toNumber(stock, product.stock_qty ?? 0) !== toNumber(product.stock_qty, 0) ||
    Boolean(active) !== Boolean(product.is_active);

  return (
    <tr style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
      <td style={{ padding: "10px 8px" }}>
        <div style={{ fontWeight: 700 }}>{product.title}</div>
        <div className="muted" style={{ fontSize: 12 }}>{product.slug}</div>
      </td>
      <td style={{ padding: "10px 8px" }}>
        <div>{product.category}</div>
        {product.subcategory ? <div className="muted" style={{ fontSize: 12 }}>{product.subcategory}</div> : null}
      </td>
      <td style={{ padding: "10px 8px" }}>GBP {toNumber(product.price).toFixed(2)}</td>
      <td style={{ padding: "10px 8px" }}>
        <input
          className="input"
          style={{ width: 110 }}
          inputMode="numeric"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          disabled={busy}
        />
      </td>
      <td style={{ padding: "10px 8px" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            disabled={busy}
          />
          <span className="p" style={{ margin: 0 }}>{active ? "Yes" : "No"}</span>
        </label>
      </td>
      <td style={{ padding: "10px 8px" }}>
        <div className="row" style={{ justifyContent: "flex-start" }}>
          <button
            className="btnPrimary"
            type="button"
            disabled={busy || !dirty}
            onClick={() =>
              onUpdate(product.id, {
                stock_qty: Math.max(0, Math.floor(toNumber(stock, product.stock_qty ?? 0))),
                is_active: Boolean(active),
              })
            }
          >
            Save
          </button>
          <button
            className="btn"
            type="button"
            disabled={busy || !dirty}
            onClick={() => {
              setStock(String(product.stock_qty ?? 0));
              setActive(Boolean(product.is_active));
            }}
          >
            Reset
          </button>
        </div>
      </td>
    </tr>
  );
}
