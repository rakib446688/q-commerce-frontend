import express from "express";
import { createSupabaseServiceClient, getAuthedUser } from "../lib/supabase.js";
import { getEnv } from "../lib/env.js";

const router = express.Router();

function parseAdminEmails() {
  const raw = getEnv("ADMIN_EMAILS") || "";
  return raw
    .split(",")
    .map((email) => String(email || "").trim().toLowerCase())
    .filter(Boolean);
}

function isAdminEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return false;
  const list = parseAdminEmails();
  return list.includes(normalized);
}

async function requireAdmin(req) {
  const authHeader = req.headers.authorization || "";
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!accessToken) {
    const error = new Error("Missing access token.");
    error.status = 401;
    throw error;
  }

  const user = await getAuthedUser(accessToken);
  if (!user) {
    const err = new Error("Invalid session.");
    err.status = 401;
    throw err;
  }

  const email = user.email || "";
  if (!isAdminEmail(email)) {
    const err = new Error("Admin access denied.");
    err.status = 403;
    throw err;
  }

  return user;
}

router.get("/products", async (req, res) => {
  const serviceSupabase = createSupabaseServiceClient();
  if (!serviceSupabase) {
    return res.status(501).json({
      error: "Admin API requires SUPABASE_SERVICE_ROLE_KEY to be configured.",
    });
  }

  try {
    await requireAdmin(req);
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 200)));
    const { data, error } = await serviceSupabase
      .from("products")
      .select("id, slug, title, category, subcategory, price, stock_qty, is_active, updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return res.json({ products: data || [] });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error?.message || "Unable to load products.",
    });
  }
});

router.patch("/products/:id", async (req, res) => {
  const serviceSupabase = createSupabaseServiceClient();
  if (!serviceSupabase) {
    return res.status(501).json({
      error: "Admin API requires SUPABASE_SERVICE_ROLE_KEY to be configured.",
    });
  }

  try {
    await requireAdmin(req);
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "Product id is required." });

    const stockQtyRaw = req.body?.stock_qty;
    const isActiveRaw = req.body?.is_active;

    const patch = {};
    if (stockQtyRaw !== undefined) {
      const qty = Number(stockQtyRaw);
      if (!Number.isFinite(qty) || qty < 0) {
        return res.status(400).json({ error: "stock_qty must be a non-negative number." });
      }
      patch.stock_qty = Math.floor(qty);
    }

    if (isActiveRaw !== undefined) {
      patch.is_active = Boolean(isActiveRaw);
    }

    if (!Object.keys(patch).length) {
      return res.status(400).json({ error: "No updatable fields provided." });
    }

    const { data, error } = await serviceSupabase
      .from("products")
      .update(patch)
      .eq("id", id)
      .select("id, slug, title, category, subcategory, price, stock_qty, is_active, updated_at")
      .single();

    if (error) throw error;
    return res.json({ product: data });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error?.message || "Unable to update product.",
    });
  }
});

export default router;
