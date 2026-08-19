import { comparisonKey } from "./normalize.js";
import { cleanPresentationArtist } from "./presentationOverlay.js";

export function normalizedPresentationTitle(value) {
  return comparisonKey(String(value || ""))
    .replace(/\b(?:vinyl|lp|remaster(?:ed)?|deluxe|expanded|anniversary|edition|reissue|explicit lyrics?|picture disc|colored vinyl|colour vinyl|mono|stereo|ogv|mov)\b/g, " ")
    .replace(/\b(?:black|blue|red|green|white|clear|gold|silver)\b(?=\s*$)/g, " ")
    .replace(/[\[\](){}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedArtist(value) {
  return comparisonKey(String(cleanPresentationArtist(value) || ""))
    .replace(/\bthe\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function presentationArtistSimilarity(left, right) {
  const leftTokens = new Set(normalizedArtist(left).split(" ").filter((token) => token.length > 1));
  const rightTokens = new Set(normalizedArtist(right).split(" ").filter((token) => token.length > 1));
  if (!leftTokens.size || !rightTokens.size) return 0;
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return overlap / Math.min(leftTokens.size, rightTokens.size);
}

export function selectPresentationReleaseGroup(product, candidates) {
  const sourceTitle = normalizedPresentationTitle(product?.title);
  const accepted = (Array.isArray(candidates) ? candidates : []).filter((candidate) => (
    Number(candidate?.score || 0) >= 95
    && String(candidate?.primaryType || "").toLowerCase() === "album"
    && normalizedPresentationTitle(candidate?.title) === sourceTitle
    && presentationArtistSimilarity(product?.artist, candidate?.artistCreditPhrase) >= 0.8
  ));
  const groups = new Map(accepted.map((candidate) => [candidate.id, candidate]));
  return groups.size === 1 ? [...groups.values()][0] : null;
}

export function presentationArtworkQuery(product) {
  const title = normalizedPresentationTitle(product?.title);
  const artist = cleanPresentationArtist(product?.artist);
  if (!title || !artist) return null;
  return { title, artist };
}
