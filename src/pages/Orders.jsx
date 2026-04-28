import { useEffect, useState } from "react";
import { getOrders } from "../lib/store/ordersStore";

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadOrders() {
      try {
        setLoading(true);
        setError("");
        const data = await getOrders();
        if (!mounted) return;
        setOrders(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!mounted) return;
        console.error("Failed to load orders:", err);
        setError(err?.message || "Unable to load orders.");
        setOrders([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadOrders();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="container">
      <div className="section">
        <h2 className="h2">Orders</h2>

        {loading ? <p className="p">Loading orders...</p> : null}
        {error ? <p className="p">{error}</p> : null}

        {!loading && !error && orders.length ? (
          <div className="ordersList">
            {orders.map((order) => (
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

        {!loading && !error && !orders.length ? (
          <div className="card">
            <p className="p">No orders yet.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}