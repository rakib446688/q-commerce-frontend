import { supabase } from "../supabaseClient";
import localCatalog from "../catalog/productsCatalog.json";

let cachedProducts = null;
let inflight = null;
let localFallback = null;
let localBySlug = null;

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function mapProductRow(row) {
  if (!row) return null;
  const mapped = {
    id: row.legacy_id || row.id,
    db_id: row.id,
    legacy_id: row.legacy_id || null,
    slug: row.slug || "",
    title: row.title || "",
    category: row.category || "",
    subcategory: row.subcategory || "",
    price: toNumber(row.price),
    rating_avg: toNumber(row.rating_avg),
    rating_count: toNumber(row.rating_count),
    colors: Array.isArray(row.colors) ? row.colors : [],
    sizes: Array.isArray(row.sizes) ? row.sizes : [],
    color_images: row.color_images || {},
    description: row.description || "",
    brand: row.brand || "",
    stock_qty: row.stock_qty ?? null,
    is_active: row.is_active ?? true,
  };

  const merged = mergeLocalImages(mapped);
  return merged;
}

function getLocalBySlug() {
  if (localBySlug) return localBySlug;
  localBySlug = new Map((localCatalog || []).map((p) => [p.slug, p]));
  return localBySlug;
}

function mergeLocalImages(product) {
  if (!product?.slug) return product;
  const local = getLocalBySlug().get(product.slug);
  if (!local) return product;

  const localFirstImage = local?.color_images ? Object.values(local.color_images)[0] : "";

  const mergedColorImages = { ...(product.color_images || {}) };

  const colors = Array.isArray(product.colors) && product.colors.length ? product.colors : local?.colors || [];
  if (localFirstImage) {
    for (const color of colors) mergedColorImages[color] = localFirstImage;
  }

  return {
    ...product,
    price:
      Number.isFinite(Number(product.price)) && Number(product.price) > 0 && Number(product.price) <= 30
        ? Number(product.price)
        : toNumber(local.price, toNumber(product.price)),
    colors,
    sizes: Array.isArray(product.sizes) && product.sizes.length ? product.sizes : local?.sizes || [],
    color_images: mergedColorImages,
  };
}

function shouldPreferSupabaseProducts(products) {
  const localMap = getLocalBySlug();
  if (!products.length) return false;

  const matched = products.reduce((count, p) => count + (localMap.has(p.slug) ? 1 : 0), 0);
  // Only trust Supabase if it looks like the same catalog (most slugs match).
  return matched >= Math.min(60, Math.floor(products.length * 0.75));
}

function getLocalFallback() {
  if (localFallback) return localFallback;
  localFallback = (localCatalog || []).map((row) => ({
    id: row.id || row.slug,
    db_id: row.db_id ?? null,
    legacy_id: row.legacy_id ?? row.slug ?? null,
    slug: row.slug || "",
    title: row.title || "",
    category: row.category || "",
    subcategory: row.subcategory || "",
    price: toNumber(row.price),
    rating_avg: toNumber(row.rating_avg),
    rating_count: toNumber(row.rating_count),
    colors: Array.isArray(row.colors) ? row.colors : [],
    sizes: Array.isArray(row.sizes) ? row.sizes : [],
    color_images: row.color_images || {},
    description: row.description || "",
    brand: row.brand || "",
    stock_qty: row.stock_qty ?? 25,
    is_active: row.is_active ?? true,
    _localCatalog: true,
  }));
  return localFallback;
}

async function fetchProducts() {
  if (cachedProducts) return cachedProducts;
  if (inflight) return inflight;

  try {
    if (!supabase) {
      cachedProducts = getLocalFallback();
      inflight = Promise.resolve(cachedProducts).finally(() => {
        inflight = null;
      });
      return inflight;
    }

    inflight = supabase
      .from("products")
      .select(
        `
          id,
          legacy_id,
          slug,
          title,
          category,
          subcategory,
          price,
          rating_avg,
          rating_count,
          colors,
          sizes,
          color_images,
          description,
          brand,
          is_active,
          stock_qty
        `
      )
      .eq("is_active", true)
    .then(({ data, error }) => {
      if (error) throw error;
      const mapped = (data || []).map(mapProductRow).filter(Boolean);
      if (mapped.length) {
        if (shouldPreferSupabaseProducts(mapped)) {
          cachedProducts = mapped;
          return cachedProducts;
        }
        cachedProducts = getLocalFallback();
        return cachedProducts;
      }
      cachedProducts = getLocalFallback();
      return cachedProducts;
    })
      .catch((error) => {
        console.warn("Supabase products unavailable; using local catalog fallback.", error);
        cachedProducts = getLocalFallback();
        return cachedProducts;
      })
      .finally(() => {
        inflight = null;
      });
  } catch (error) {
    console.warn("Products store init failed; using local catalog fallback.", error);
    cachedProducts = getLocalFallback();
    inflight = Promise.resolve(cachedProducts).finally(() => {
      inflight = null;
    });
  }

  return inflight;
}

export async function getAllProducts() {
  try {
    return await fetchProducts();
  } catch (error) {
    console.warn("getAllProducts failed; using local catalog fallback.", error);
    return getLocalFallback();
  }
}

export async function getProductsByCategory(category, subcategory) {
  const cat = (category || "").trim();
  const sub = (subcategory || "").trim();
  let products = [];
  try {
    products = await fetchProducts();
  } catch (error) {
    console.warn("getProductsByCategory failed; using local catalog fallback.", error);
    products = getLocalFallback();
  }
  return products.filter((product) => {
    if (cat && product.category !== cat) return false;
    if (sub && product.subcategory !== sub) return false;
    return true;
  });
}

export async function getProductById(id) {
  if (!id) return null;

  const safeId = String(id);
  const products = cachedProducts || [];
  const fromCache = products.find(
    (product) =>
      product.id === safeId ||
      product.db_id === safeId ||
      product.legacy_id === safeId ||
      product.slug === safeId
  );
  if (fromCache) return fromCache;

  try {
    const { data, error } = await supabase
      .from("products")
      .select(
        `
        id,
        legacy_id,
        slug,
        title,
        category,
        subcategory,
        price,
        rating_avg,
        rating_count,
        colors,
        sizes,
        color_images,
        description,
        brand,
        is_active,
        stock_qty
      `
      )
      .or(`legacy_id.eq.${id},id.eq.${id},slug.eq.${id}`)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    const mapped = mapProductRow(data);
    if (!mapped) return null;
    cachedProducts = cachedProducts ? [...cachedProducts, mapped] : [mapped];
    return mapped;
  } catch (error) {
    const fallback = getLocalFallback().find(
      (product) => product.slug === safeId || product.id === safeId || product.legacy_id === safeId
    );
    if (fallback) return fallback;
    console.warn("Unable to load product:", error);
    return null;
  }
}

