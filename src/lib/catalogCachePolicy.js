const SHARED_CACHE_HEADERS = Object.freeze({
  "Cache-Control": "public, max-age=0, must-revalidate",
  "Netlify-CDN-Cache-Control": "public, durable, s-maxage=300, stale-while-revalidate=600",
});

export function catalogCacheHeaders() {
  return { ...SHARED_CACHE_HEADERS, "Netlify-Vary": "query" };
}

export function productDetailCacheHeaders() {
  return { ...SHARED_CACHE_HEADERS };
}
