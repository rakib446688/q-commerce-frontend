import { supabase } from "../supabaseClient";
import { placeOrder } from "../ordersApi";

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function mapOrderItemRow(row) {
  return {
    id: row.id,
    order_id: row.order_id,
    productId: row.product_id || null,
    product_slug: row.product_slug || null,
    title: row.title || "Item",
    price: toNumber(row.price),
    quantity: toNumber(row.quantity, 1),
    line_total: toNumber(row.line_total, toNumber(row.price) * toNumber(row.quantity, 1)),
    color: row.color || "",
    size: row.size || "",
    image_url: row.image_url || "",
    created_at: row.created_at,
  };
}

function mapOrderRow(row) {
  const items = Array.isArray(row.order_items) ? row.order_items.map(mapOrderItemRow) : [];

  return {
    id: row.id,
    placed_at: row.created_at,
    subtotal: toNumber(row.subtotal),
    shipping: toNumber(row.shipping),
    total: toNumber(row.total),
    status: row.status || "pending",
    currency_code: row.currency_code || "GBP",
    customer_name: row.customer_name || "",
    customer_email: row.customer_email || "",
    delivery_address: row.delivery_address || "",
    payment_status: row.payment_status || row.status || "pending",
    payment_method: row.payment_method || "",
    notes: row.notes || "",
    items,
  };
}

export async function getOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id,
      user_id,
      subtotal,
      shipping,
      total,
      status,
      currency_code,
      customer_name,
      customer_email,
      delivery_address,
      payment_status,
      payment_method,
      notes,
      created_at,
      order_items (
        id,
        order_id,
        product_id,
        product_slug,
        title,
        price,
        quantity,
        line_total,
        color,
        size,
        image_url,
        created_at
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map(mapOrderRow);
}

export async function addOrder({
  userId,
  items,
  subtotal,
  shipping,
  total,
  customer,
}) {
  if (!userId) {
    throw new Error("You must be logged in to place an order.");
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Your cart is empty.");
  }

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  // Prefer server-side checkout so we can enforce stock and safely decrement stock_qty.
  try {
    const { data } = await supabase.auth.getSession();
    const accessToken = data?.session?.access_token || "";
    if (accessToken) {
      const order = await placeOrder({
        accessToken,
        items: items.map((entry) => ({
          productId: entry?.product?.db_id || entry?.productId || entry?.product?.id || "",
          quantity: entry?.quantity || 1,
          color: entry?.color || "",
          size: entry?.size || "",
        })),
        customer: {
          name: customer?.name || "",
          email: customer?.email || "",
          address: customer?.address || "",
        },
      });

      if (order?.id) {
        return {
          ...order,
          customer: customer || null,
        };
      }
    }
  } catch (error) {
    const requiresServer = String(import.meta.env.VITE_SERVER_CHECKOUT_REQUIRED || "").toLowerCase() === "true";
    if (requiresServer) {
      throw error;
    }
    console.warn("Server checkout unavailable; falling back to direct Supabase order insert.", error);
  }

  const cleanSubtotal = toNumber(subtotal);
  const cleanShipping = toNumber(shipping);
  const cleanTotal = toNumber(total);

  if (cleanSubtotal < 0 || cleanShipping < 0 || cleanTotal < 0) {
    throw new Error("Invalid order totals.");
  }

  // Insert order first
  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      subtotal: cleanSubtotal,
      shipping: cleanShipping,
      total: cleanTotal,
      status: "paid",
      currency_code: "GBP",
      customer_name: customer?.name || null,
      customer_email: customer?.email || null,
      delivery_address: customer?.address || null,
      payment_status: "paid",
      payment_method: "manual",
    })
    .select(
      "id, user_id, subtotal, shipping, total, status, currency_code, customer_name, customer_email, delivery_address, payment_status, payment_method, notes, created_at"
    )
    .single();

  if (orderError) {
    throw orderError;
  }

  // Insert order items (snapshot-style)
  const lineItems = items.map((entry) => {
    const product = entry.product || null;
    const rawProductId = product?.db_id || entry.productId || product?.id || null;
    const productId = isUuid(rawProductId) ? rawProductId : null;

    const title = entry.title || product?.title || "Item";
    const price = toNumber(entry.price ?? product?.price);
    const quantity = Math.max(1, toNumber(entry.quantity, 1));
    const lineTotal = toNumber(price * quantity);
    const imageUrl =
      (entry.color && product?.color_images?.[entry.color]) ||
      (product?.color_images ? Object.values(product.color_images)[0] : "") ||
      "";

    return {
      order_id: orderRow.id,
      product_id: productId,
      product_slug: product?.slug || null,
      title,
      price,
      quantity,
      line_total: lineTotal,
      color: entry.color || null,
      size: entry.size || null,
      image_url: imageUrl || null,
    };
  });

  const { data: itemRows, error: itemsError } = await supabase
    .from("order_items")
    .insert(lineItems)
    .select(
      "id, order_id, product_id, product_slug, title, price, quantity, line_total, color, size, image_url, created_at"
    );

  if (itemsError) {
    // Note: order may already be inserted. Full rollback would require server-side transaction (RPC/Edge Function).
    throw itemsError;
  }

  return {
    id: orderRow.id,
    placed_at: orderRow.created_at,
    subtotal: toNumber(orderRow.subtotal),
    shipping: toNumber(orderRow.shipping),
    total: toNumber(orderRow.total),
    status: orderRow.status || "paid",
    currency_code: orderRow.currency_code || "GBP",
    customer_name: orderRow.customer_name || "",
    customer_email: orderRow.customer_email || "",
    delivery_address: orderRow.delivery_address || "",
    payment_status: orderRow.payment_status || orderRow.status || "paid",
    payment_method: orderRow.payment_method || "manual",
    notes: orderRow.notes || "",
    items: (itemRows || []).map(mapOrderItemRow),
    customer: customer || null,
  };
}

