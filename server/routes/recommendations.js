import express from "express";
import { lmStudioEmbed } from "../lib/lmstudioEmbeddings.js";
import { createSupabaseAnonClient, createSupabaseServiceClient } from "../lib/supabase.js";
import { getEnv } from "../lib/env.js";

const router = express.Router();

function toSafeInt(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.floor(num) : fallback;
}

function requireServiceSupabase() {
  const service = createSupabaseServiceClient();
  if (!service) {
    const error = new Error("Vector recommendations require SUPABASE_SERVICE_ROLE_KEY to be configured on the server.");
    error.status = 501;
    throw error;
  }
  return service;
}

function buildReason({ similarity, query }) {
  const sim = Number(similarity);
  const score = Number.isFinite(sim) ? Math.max(-1, Math.min(1, sim)) : null;
  const prefix = query ? `Matches "${query}"` : "Recommended";
  if (score === null) return `${prefix} based on semantic similarity.`;
  return `${prefix} based on semantic similarity (score ${score.toFixed(2)}).`;
}

async function getPopularProducts(limit) {
  const supabase = createSupabaseAnonClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, slug, title, category, subcategory, price, rating_avg, rating_count, is_active")
    .eq("is_active", true)
    .order("rating_count", { ascending: false })
    .order("rating_avg", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function matchProductsByEmbedding({ embedding, limit, threshold }) {
  const supabase = requireServiceSupabase();

  const { data, error } = await supabase.rpc("match_products", {
    query_embedding: embedding,
    match_count: limit,
    match_threshold: threshold,
  });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

router.post("/", async (req, res) => {
  try {
    const query = String(req.body?.query || "").trim();
    const rawLimit = toSafeInt(req.body?.limit, 8);
    const limit = Math.max(1, Math.min(12, rawLimit || 8));

    if (!query) {
      const popular = await getPopularProducts(limit);
      return res.json({
        recommendations: popular.map((p) => ({
          slug: p.slug,
          reason: "Recommended based on store popularity.",
        })),
        source: "popular",
      });
    }

    let embedding;
    try {
      embedding = await lmStudioEmbed({ input: query, timeoutMs: 20000 });
    } catch (error) {
      console.error("Embedding generation failed:", error?.message || error);
      return res.status(502).json({
        error: "Embeddings are unavailable. Ensure LM Studio is running and LMSTUDIO_BASE_URL + LMSTUDIO_EMBEDDING_MODEL are set.",
      });
    }

    let matches = [];
    try {
      matches = await matchProductsByEmbedding({
        embedding,
        limit: Math.max(limit, 24),
        threshold: 0.15,
      });
    } catch (error) {
      const message = String(error?.message || "");
      const isMissingFn = message.includes("match_products") && message.toLowerCase().includes("could not find");
      const isMissingTable = message.toLowerCase().includes("product_embeddings") || message.toLowerCase().includes("relation");

      if (isMissingFn || isMissingTable) {
        return res.status(501).json({
          error: "Vector recommendations are not set up in Supabase yet. Run the provided pgvector SQL and backfill embeddings.",
          code: "VECTOR_NOT_READY",
        });
      }

      throw error;
    }

    const recommendations = matches
      .filter((row) => row?.slug)
      .slice(0, limit)
      .map((row) => ({
        slug: row.slug,
        reason: buildReason({ similarity: row.similarity, query }),
      }));

    return res.json({
      recommendations,
      source: "vector",
      embedding_model: getEnv("LMSTUDIO_EMBEDDING_MODEL"),
    });
  } catch (error) {
    console.error("Recommendations route error:", error);
    return res.status(error?.status || 500).json({
      error: error?.message || "Recommendations request failed.",
    });
  }
});

export default router;
