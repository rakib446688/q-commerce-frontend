import express from "express";
import { createSupabaseServiceClient, getAuthedUser } from "../lib/supabase.js";

const router = express.Router();

function getBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  return authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items
    .map((item) => ({
      productId: String(item?.productId || "").trim(),
      quantity: Math.max(1, toNumber(item?.quantity, 1)),
      color: String(item?.color || "").trim(),
      size: String(item?.size || "").trim(),
    }))
    .filter((item) => item.productId);
}

function buildImageUrl(productRow, color) {
  const images = productRow?.color_images && typeof productRow.color_images === "object"
    ? productRow.color_images
    : {};
  if (color && images[color]) return images[color];
  return Object.values(images)[0] || "";
}

router.post("/place", async (req, res) => {
  const serviceSupabase = createSupabaseServiceClient();
  if (!serviceSupabase) {
    return res.status(501).json({
      error: "Server checkout requires SUPABASE_SERVICE_ROLE_KEY to be configured.",
    });
  }

  try {
    const accessToken = getBearerToken(req);
    const user = await getAuthedUser(accessToken);
    if (!user?.id) {
      return res.status(401).json({ error: "You must be logged in to place an order." });
    }

    const { items, customer } = req.body || {};
    const normalizedItems = normalizeItems(items);
    if (!normalizedItems.length) {
      return res.status(400).json({ error: "Cart items are required." });
    }

    const customerName = String(customer?.name || "").trim();
    const customerEmail = String(customer?.email || "").trim();
    const deliveryAddress = String(customer?.address || "").trim();
    if (!customerName || !customerEmail || !deliveryAddress) {
      return res.status(400).json({ error: "Customer name, email, and address are required." });
    }

    const uniqueIds = Array.from(new Set(normalizedItems.map((item) => item.productId)));
    const { data: productRows, error: productError } = await serviceSupabase
      .from("products")
      .select("id, slug, title, category, subcategory, price, stock_qty, is_active, color_images")
      .in("id", uniqueIds);

    if (productError) throw productError;

    const byId = new Map((productRows || []).map((row) => [row.id, row]));
    const missing = uniqueIds.filter((id) => !byId.has(id));
    if (missing.length) {
      return res.status(400).json({ error: "Some products no longer exist in the catalog." });
    }

    const cartWithRows = normalizedItems.map((item) => ({
      ...item,
      product: byId.get(item.productId),
    }));

    const totalByProductId = new Map();
    for (const entry of cartWithRows) {
      totalByProductId.set(entry.productId, (totalByProductId.get(entry.productId) || 0) + entry.quantity);
    }

    const outOfStock = Array.from(totalByProductId.entries())
      .map(([productId, totalQty]) => ({
        productId,
        totalQty,
        product: byId.get(productId),
      }))
      .filter((entry) => {
        const stock = toNumber(entry.product?.stock_qty, 0);
        const active = entry.product?.is_active !== false;
        return !active || stock < entry.totalQty;
      });

    if (outOfStock.length) {
      return res.status(409).json({
        error: "Some items are out of stock.",
        outOfStock: outOfStock.map((entry) => ({
          productId: entry.productId,
          title: entry.product?.title || "Item",
          available: toNumber(entry.product?.stock_qty, 0),
          requested: entry.totalQty,
          is_active: entry.product?.is_active !== false,
        })),
      });
    }

    const reserved = [];
    try {
      for (const [productId, totalQty] of totalByProductId.entries()) {
        const product = byId.get(productId);
        const currentStock = toNumber(product?.stock_qty, 0);
        const nextStock = currentStock - totalQty;
        const { data: updated, error: updateError } = await serviceSupabase
          .from("products")
          .update({ stock_qty: nextStock })
          .eq("id", productId)
          .eq("stock_qty", currentStock)
          .gte("stock_qty", totalQty)
          .select("id, stock_qty")
          .maybeSingle();

        if (updateError) throw updateError;
        if (!updated?.id) {
          throw new Error("Stock changed during checkout. Please try again.");
        }
        reserved.push({ productId, reservedQty: totalQty });
      }
    } catch (error) {
      for (const entry of reserved) {
        try {
          const { data: row } = await serviceSupabase
            .from("products")
            .select("stock_qty")
            .eq("id", entry.productId)
            .maybeSingle();

          const current = toNumber(row?.stock_qty, 0);
          await serviceSupabase
            .from("products")
            .update({ stock_qty: current + entry.reservedQty })
            .eq("id", entry.productId)
            .eq("stock_qty", current);
        } catch (rollbackError) {
          console.warn("Stock rollback failed for product:", entry.productId, rollbackError?.message || rollbackError);
        }
      }
      throw error;
    }

    const subtotal = cartWithRows.reduce((sum, entry) => sum + toNumber(entry.product?.price) * entry.quantity, 0);
    const shipping = cartWithRows.length ? 3 : 0;
    const total = subtotal + shipping;

    const { data: orderRow, error: orderError } = await serviceSupabase
      .from("orders")
      .insert({
        user_id: user.id,
        subtotal,
        shipping,
        total,
        status: "paid",
        currency_code: "GBP",
        customer_name: customerName,
        customer_email: customerEmail,
        delivery_address: deliveryAddress,
        payment_status: "paid",
        payment_method: "manual",
      })
      .select(
        "id, user_id, subtotal, shipping, total, status, currency_code, customer_name, customer_email, delivery_address, payment_status, payment_method, notes, created_at"
      )
      .single();

    if (orderError) {
      for (const entry of reserved) {
        try {
          const { data: row } = await serviceSupabase
            .from("products")
            .select("stock_qty")
            .eq("id", entry.productId)
            .maybeSingle();

          const current = toNumber(row?.stock_qty, 0);
          await serviceSupabase
            .from("products")
            .update({ stock_qty: current + entry.reservedQty })
            .eq("id", entry.productId)
            .eq("stock_qty", current);
        } catch (rollbackError) {
          console.warn("Stock rollback failed for product:", entry.productId, rollbackError?.message || rollbackError);
        }
      }
      throw orderError;
    }

    const lineItems = cartWithRows.map((entry) => {
      const product = entry.product;
      const price = toNumber(product?.price);
      const lineTotal = toNumber(price * entry.quantity);
      return {
        order_id: orderRow.id,
        product_id: entry.productId,
        product_slug: product?.slug || null,
        title: product?.title || "Item",
        price,
        quantity: entry.quantity,
        line_total: lineTotal,
        color: entry.color || null,
        size: entry.size || null,
        image_url: buildImageUrl(product, entry.color) || null,
      };
    });

    const { data: itemRows, error: itemError } = await serviceSupabase
      .from("order_items")
      .insert(lineItems)
      .select("id, order_id, product_id, product_slug, title, price, quantity, line_total, color, size, image_url, created_at");

    if (itemError) throw itemError;

    return res.json({
      order: {
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
        items: (itemRows || []).map((row) => ({
          id: row.id,
          order_id: row.order_id,
          productId: row.product_id || null,
          product_slug: row.product_slug || null,
          title: row.title || "Item",
          price: toNumber(row.price),
          quantity: toNumber(row.quantity, 1),
          line_total: toNumber(row.line_total),
          color: row.color || "",
          size: row.size || "",
          image_url: row.image_url || "",
          created_at: row.created_at,
        })),
      },
    });
  } catch (error) {
    console.error("Place order error:", error);
    return res.status(500).json({
      error: error?.message || "Unable to place order.",
    });
  }
});

export default router;
