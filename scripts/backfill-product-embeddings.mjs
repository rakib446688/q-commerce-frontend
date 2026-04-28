import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { getEnv, requireAnyEnv, requireEnv } from "../server/lib/env.js";
import { lmStudioEmbed } from "../server/lib/lmstudioEmbeddings.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

function toSafeInt(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.floor(num) : fallback;
}

function chunkArray(values, size) {
  const chunks = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
}

function productToEmbeddingText(product) {
  const title = String(product?.title || "").trim();
  const category = String(product?.category || "").trim();
  const subcategory = String(product?.subcategory || "").trim();
  const brand = String(product?.brand || "").trim();
  const description = String(product?.description || "").replace(/\s+/g, " ").trim();
  const colors = Array.isArray(product?.colors) ? product.colors.filter(Boolean).join(", ") : "";
  const sizes = Array.isArray(product?.sizes) ? product.sizes.filter(Boolean).join(", ") : "";

  return [
    `Title: ${title}`,
    `Category: ${category}${subcategory ? ` / ${subcategory}` : ""}`,
    brand ? `Brand: ${brand}` : "",
    colors ? `Colors: ${colors}` : "",
    sizes ? `Sizes: ${sizes}` : "",
    description ? `Description: ${description}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function fetchProducts(supabase, limit) {
  const { data, error } = await supabase
    .from("products")
    .select("id, slug, title, category, subcategory, description, brand, colors, sizes, is_active, updated_at")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function upsertEmbeddings(supabase, rows) {
  const { error } = await supabase
    .from("product_embeddings")
    .upsert(rows, { onConflict: "product_id" });

  if (error) throw error;
}

async function main() {
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const batchArg = process.argv.find((arg) => arg.startsWith("--batch="));

  const limit = Math.max(1, Math.min(5000, toSafeInt(limitArg?.split("=")[1], 500)));
  const batchSize = Math.max(1, Math.min(64, toSafeInt(batchArg?.split("=")[1], 24)));

  const supabaseUrl = requireAnyEnv(["SUPABASE_URL", "VITE_SUPABASE_URL"]);
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const embeddingModel = requireEnv("LMSTUDIO_EMBEDDING_MODEL");
  const baseUrl = requireEnv("LMSTUDIO_BASE_URL");

  console.log("Backfill starting:", {
    limit,
    batchSize,
    supabaseUrlPresent: Boolean(supabaseUrl),
    embeddingModel,
    lmstudioBaseUrl: baseUrl,
    meilisearchConfigured: Boolean(getEnv("MEILISEARCH_URL")),
  });

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const products = await fetchProducts(supabase, limit);
  console.log(`Loaded ${products.length} active products.`);

  const items = products
    .map((p) => ({
      product: p,
      text: productToEmbeddingText(p),
    }))
    .filter((item) => item.text && item.product?.id);

  const batches = chunkArray(items, batchSize);
  let done = 0;

  for (const batch of batches) {
    const inputs = batch.map((b) => b.text);
    const embeddings = await lmStudioEmbed({ input: inputs, timeoutMs: 30000 });
    const rows = batch.map((b, index) => ({
      product_id: b.product.id,
      embedding: embeddings[index],
      embedding_model: embeddingModel,
    }));

    await upsertEmbeddings(supabase, rows);
    done += batch.length;
    process.stdout.write(`Upserted ${done}/${items.length} embeddings\r`);
  }

  process.stdout.write("\n");
  console.log("Backfill complete.");
}

main().catch((err) => {
  console.error("Backfill failed:", err?.message || err);
  process.exitCode = 1;
});

