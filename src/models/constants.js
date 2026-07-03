export const PRODUCT_GENRES = [
  "Jazz",
  "Rock",
  "Soul",
  "Electronic",
  "Classical",
  "Folk",
  "Hip-Hop",
  "Blues",
];

export const PRODUCT_CONDITIONS = ["M", "NM", "VG+", "VG", "G"];
export const PRODUCT_STOCK_LEVELS = ["in", "low", "out"];
export const PRODUCT_FORMATS = ["LP, 33 1/3 rpm", "2xLP", "3xLP", "2xLP + EP"];
export const USER_ROLES = ["customer", "admin"];

export const INTERACTION_TYPES = [
  "recommendation_impression",
  "recommendation_click",
  "recommendation_wishlist_add",
  "recommendation_cart_add",
  "recommendation_dismiss",
  "product_view",
  "wishlist_add",
  "wishlist_remove",
  "cart_add",
  "cart_remove",
  "cart_quantity",
  "rating_set",
  "rating_remove",
  "search_submit",
  "search_result_click",
  "demo_checkout_complete",
];

export const RETENTION_DAYS = 90;
export const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;
