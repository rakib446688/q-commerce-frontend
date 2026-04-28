import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getOrders } from "../lib/store/ordersStore";
import { createPageUrl } from "../lib/pages";
import { useAuth } from "../context/AuthContext";

export default function Account() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const email = user?.email || "customer@qcommerce.com";

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");

  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadOrders() {
      try {
        setOrdersLoading(true);
        setOrdersError("");
        const data = await getOrders();
        if (!mounted) return;
        setOrders(Array.isArray(data) ? data : []);
      } catch (error) {
        if (!mounted) return;
        console.error("Failed to load account orders:", error);
        setOrdersError(error?.message || "Unable to load recent orders.");
        setOrders([]);
      } finally {
        if (mounted) setOrdersLoading(false);
      }
    }

    loadOrders();

    return () => {
      mounted = false;
    };
  }, []);

  const recentOrders = useMemo(() => orders.slice(0, 5), [orders]);

  async function handleSignOut() {
    setSignOutError("");
    setSigningOut(true);

    const { error } = await logout();

    setSigningOut(false);

    if (error) {
      setSignOutError(error.message || "Unable to sign out. Please try again.");
      return;
    }

    navigate(createPageUrl("Login"), { replace: true });
  }

  return (
    <div className="container">
      <div className="section">
        <h2 className="h2 thinTitle">Account</h2>

        <div className="accountGrid">
          <div className="card profileCard">
            <h3 className="cardTitle">Profile</h3>
            <p className="cardBody">{email}</p>
          </div>

          <div className="accountActions">
            <button className="card actionTile" onClick={() => navigate(createPageUrl("Orders"))}>
              My Orders
            </button>

            <button className="card actionTile" onClick={() => navigate(createPageUrl("Wishlist"))}>
              Wishlist
            </button>

            <button className="card actionTile" onClick={handleSignOut} disabled={signingOut}>
              {signingOut ? "Signing out..." : "Sign Out"}
            </button>
          </div>
        </div>

        {signOutError ? <p className="p">{signOutError}</p> : null}

        <div className="sectionHead">
          <h3 className="h2 thinTitle">Recent Orders</h3>
        </div>

        {ordersLoading ? <p className="p">Loading recent orders...</p> : null}
        {ordersError ? <p className="p">{ordersError}</p> : null}

        {!ordersLoading && !ordersError && recentOrders.length ? (
          <div className="ordersList">
            {recentOrders.map((order) => (
              <div key={order.id} className="card orderRow">
                <div>
                  <div className="orderTitle">Order {order.id}</div>
                  <div className="orderMeta">{new Date(order.placed_at).toLocaleString()}</div>
                </div>
                <div className="orderMeta">Items: {order.items?.length || 0}</div>
                <div className="orderMeta">GBP {Number(order.total || 0).toFixed(2)}</div>
                <span className="statusPill">{order.status || "Paid"}</span>
              </div>
            ))}
          </div>
        ) : null}

        {!ordersLoading && !ordersError && !recentOrders.length ? (
          <div className="card">
            <p className="p">No orders yet.</p>
            <button className="btnPrimary" onClick={() => navigate(createPageUrl("Shop"))}>
              Start shopping
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}