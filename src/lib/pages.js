import { pages } from "../pages.config";

export function createPageUrl(nameWithQuery) {
  if (!nameWithQuery) return "/";
  const [name, query = ""] = nameWithQuery.split("?");
  const base = pages[name] || "/";
  return query ? `${base}?${query}` : base;
}

export function createProductUrl(productId) {
  return `/product/${productId}`;
}
