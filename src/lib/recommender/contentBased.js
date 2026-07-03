import { getCatalogRepository } from "../db/dataSource.js";
import { getProductRecord } from "../../services/catalog.js";

export const ALGORITHM_VERSION = process.env.RECOMMENDER_ALGORITHM_VERSION || "content-demo-v1";

const SCORE = {
  sameArtist: 6,
  sameGenre: 4,
  sameDecade: 2,
  sameLabel: 1,
  preferredGenre: 2,
};

const STOCK_BOOST = { in: 1, low: 0.5, out: 0 };

const DEMO_PROFILE = {
  purchasedIds: [1],
  wishlistIds: [2, 3, 4],
  favoriteGenres: ["Jazz", "Soul", "Electronic", "Folk"],
};

const era = (year) => Math.floor(year / 10) * 10;

function compareProducts(source, candidate) {
  let score = 0;
  const reasons = [];

  if (source.artist === candidate.artist) {
    score += SCORE.sameArtist;
    reasons.push(`Same artist as ${source.title}.`);
  }
  if (source.genre === candidate.genre) {
    score += SCORE.sameGenre;
    reasons.push(`Shares the ${source.genre} genre.`);
  }
  if (era(source.year) === era(candidate.year)) {
    score += SCORE.sameDecade;
    reasons.push(`Released in the same decade as ${source.title}.`);
  }
  if (source.label === candidate.label) {
    score += SCORE.sameLabel;
    reasons.push(`Released by ${source.label}.`);
  }
  score += STOCK_BOOST[candidate.stock] || 0;

  return { score, reasons };
}

function diversify(scored, limit) {
  const artistCounts = new Map();
  const selected = [];

  for (const item of scored) {
    const count = artistCounts.get(item.product.artist) || 0;
    if (count >= 2) continue;
    selected.push(item);
    artistCounts.set(item.product.artist, count + 1);
    if (selected.length === limit) break;
  }

  return selected.map((item, index) => ({ ...item, rank: index + 1 }));
}

export async function recommendForProduct(
  sourceId,
  limit = 6,
  { repository = getCatalogRepository() } = {},
) {
  const source = await getProductRecord(sourceId, { repository });
  const candidates = await repository.listRecommendationCandidates();
  const scored = candidates
    .filter((candidate) => candidate.id !== source.id && candidate.stock !== "out")
    .map((candidate) => {
      const match = compareProducts(source, candidate);
      return {
        product: candidate,
        score: match.score,
        reasons: match.reasons.length ? match.reasons.slice(0, 2) : ["Available in the demo catalog."],
        algorithmVersion: ALGORITHM_VERSION,
      };
    })
    .sort((a, b) => b.score - a.score || a.product.title.localeCompare(b.product.title));

  return {
    sourceProductId: source.id,
    mode: "content-similarity",
    recommendations: diversify(scored, limit),
    algorithmVersion: ALGORITHM_VERSION,
  };
}

function genericRecommendations(records, limit) {
  const scored = records
    .filter((record) => record.stock !== "out")
    .map((record) => ({
      product: record,
      score: STOCK_BOOST[record.stock],
      reasons: ["Available now in the demo catalog."],
      algorithmVersion: ALGORITHM_VERSION,
    }))
    .sort((a, b) => b.product.year - a.product.year || a.product.title.localeCompare(b.product.title));

  return diversify(scored, limit);
}

export async function recommendForUser(
  requestedUserId,
  limit = 8,
  { repository = getCatalogRepository() } = {},
) {
  const records = await repository.listRecommendationCandidates();
  if (requestedUserId !== "demo-user") {
    return {
      userId: requestedUserId,
      mode: "cold-start",
      profileSummary: ["No stored history is available.", "Results use the in-stock demo catalog."],
      recommendations: genericRecommendations(records, limit),
      algorithmVersion: ALGORITHM_VERSION,
    };
  }

  const sourceIds = [...DEMO_PROFILE.purchasedIds, ...DEMO_PROFILE.wishlistIds];
  const sources = await Promise.all(
    sourceIds.map((id) => getProductRecord(id, { repository })),
  );
  const excluded = new Set(sourceIds);
  const scored = records
    .filter((candidate) => !excluded.has(candidate.id) && candidate.stock !== "out")
    .map((candidate) => {
      let score = 0;
      const reasons = new Set();
      for (const source of sources) {
        const match = compareProducts(source, candidate);
        score += match.score;
        match.reasons.forEach((reason) => reasons.add(reason));
      }
      if (DEMO_PROFILE.favoriteGenres.includes(candidate.genre)) {
        score += SCORE.preferredGenre;
        reasons.add(`Matches the demo profile's ${candidate.genre} preference.`);
      }
      return {
        product: candidate,
        score,
        reasons: [...reasons].slice(0, 2),
        algorithmVersion: ALGORITHM_VERSION,
      };
    })
    .sort((a, b) => b.score - a.score || a.product.title.localeCompare(b.product.title));

  return {
    userId: requestedUserId,
    mode: "demo-profile",
    profileSummary: [
      "Purchased: Kind of Blue",
      "Wishlist: Innervisions, Blue, and Homework",
      "Preferred demo genres: Jazz, Soul, Electronic, and Folk",
    ],
    recommendations: diversify(scored, limit),
    algorithmVersion: ALGORITHM_VERSION,
  };
}
