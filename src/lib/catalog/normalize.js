import {
  PRODUCT_CONDITIONS,
  PRODUCT_FORMATS,
  PRODUCT_GENRES,
  PRODUCT_STOCK_LEVELS,
} from "../../models/constants.js";

const GENRE_ALIASES = new Map([
  ["r&b", "Soul"],
  ["rhythm and blues", "Soul"],
  ["electronica", "Electronic"],
  ["electronic music", "Electronic"],
  ["hip hop", "Hip-Hop"],
  ["hiphop", "Hip-Hop"],
  ["classic", "Classical"],
]);

const STOCK_ALIASES = new Map([
  ["in stock", "in"],
  ["available", "in"],
  ["low stock", "low"],
  ["limited", "low"],
  ["out of stock", "out"],
  ["sold out", "out"],
]);

const FORMAT_ALIASES = new Map([
  ["lp", "LP, 33 1/3 rpm"],
  ["33 1/3 rpm", "LP, 33 1/3 rpm"],
  ["double lp", "2xLP"],
  ["triple lp", "3xLP"],
  ["eight lp", "8xLP"],
  ["eleven lp", "11xLP"],
]);

export function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function comparisonKey(value) {
  return normalizeWhitespace(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US");
}

function controlledValue(value, allowed, aliases = new Map()) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return null;
  const key = comparisonKey(normalized);
  const canonical = allowed.find((item) => comparisonKey(item) === key);
  return canonical || aliases.get(key) || null;
}

export const normalizeGenre = (value) => controlledValue(value, PRODUCT_GENRES, GENRE_ALIASES);
export const normalizeStock = (value) => controlledValue(value, PRODUCT_STOCK_LEVELS, STOCK_ALIASES);
export const normalizeCondition = (value) => controlledValue(value, PRODUCT_CONDITIONS);
export const normalizeFormat = (value) => controlledValue(value, PRODUCT_FORMATS, FORMAT_ALIASES);

export function normalizeUuid(value) {
  const normalized = normalizeWhitespace(value).toLowerCase();
  return normalized || null;
}

export function normalizedProductIdentity(record) {
  return [
    comparisonKey(record.artist),
    comparisonKey(record.title),
    record.year ?? "unknown-year",
    comparisonKey(record.format),
  ].join("|");
}

export function normalizedPressingIdentity(record) {
  return `${normalizedProductIdentity(record)}|${comparisonKey(record.pressing)}`;
}

export const CONTROLLED_IMPORT_VALUES = Object.freeze({
  genres: [...PRODUCT_GENRES],
  stock: [...PRODUCT_STOCK_LEVELS],
  conditions: [...PRODUCT_CONDITIONS],
  formats: [...PRODUCT_FORMATS],
  currencies: ["USD"],
});
