import { createJsonFileCache } from "./jsonFileCache.js";

const API_ROOT = "https://musicbrainz.org/ws/2";
const REQUEST_INTERVAL_MS = 1_000;
const REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_USER_AGENT = "GroovehausAcademic/0.1 (https://github.com/PracticalSwan/vinyl_record_store_backend)";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ExternalCatalogError extends Error {
  constructor(message, { status = 0, service = "external" } = {}) {
    super(message);
    this.name = "ExternalCatalogError";
    this.status = status;
    this.service = service;
  }
}

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function meaningfulUserAgent(value) {
  const userAgent = String(value || "").trim();
  if (!/^\S+\/\S+\s+\(.+\)$/.test(userAgent)) {
    throw new Error("MUSICBRAINZ_USER_AGENT must include an application name, version, and contact.");
  }
  return userAgent;
}

function releaseSummary(release) {
  if (!UUID_PATTERN.test(String(release?.id || ""))) return null;
  const credits = release["artist-credit"] || [];
  return {
    id: release.id,
    title: release.title,
    score: Number(release.score ?? 0),
    status: release.status || null,
    date: release.date || null,
    country: release.country || null,
    artistCredit: credits.map((credit) => credit.name).filter(Boolean),
    artistCreditPhrase: credits.map((credit) => `${credit.name || ""}${credit.joinphrase || ""}`).join(""),
    releaseGroupId: UUID_PATTERN.test(String(release["release-group"]?.id || ""))
      ? release["release-group"].id
      : null,
    releaseGroupTitle: release["release-group"]?.title || null,
    label: (release["label-info"] || []).map((item) => item.label?.name).find(Boolean) || null,
    genres: [...(release.genres || []), ...(release["release-group"]?.genres || [])]
      .filter((item) => item?.name)
      .sort((left, right) => Number(right.count || 0) - Number(left.count || 0))
      .map((item) => item.name),
  };
}

export function createMusicBrainzClient({
  fetchImpl = globalThis.fetch,
  sleep = pause,
  now = () => Date.now(),
  cache = createJsonFileCache(),
  userAgent = process.env.MUSICBRAINZ_USER_AGENT || DEFAULT_USER_AGENT,
} = {}) {
  const applicationUserAgent = meaningfulUserAgent(userAgent);
  let nextRequestAt = 0;

  const request = async (path, parameters = {}) => {
    const url = new URL(`${API_ROOT}/${path}`);
    for (const [key, value] of Object.entries(parameters)) {
      if (value !== null && value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
    url.searchParams.set("fmt", "json");
    const cacheKey = `musicbrainz:${url}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const delay = Math.max(0, nextRequestAt - now());
    if (delay) await sleep(delay);
    nextRequestAt = now() + REQUEST_INTERVAL_MS;
    let response;
    try {
      response = await fetchImpl(url, {
        headers: { Accept: "application/json", "User-Agent": applicationUserAgent },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new ExternalCatalogError(`MusicBrainz request failed: ${error.name || "network error"}.`, {
        service: "musicbrainz",
      });
    }
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new ExternalCatalogError(`MusicBrainz returned HTTP ${response.status}.`, {
        status: response.status,
        service: "musicbrainz",
      });
    }
    const payload = await response.json();
    await cache.set(cacheKey, payload);
    return payload;
  };

  return {
    async findReleaseCandidates({ title, artist, year, limit = 5 }) {
      const query = [
        `release:${JSON.stringify(title)}`,
        `artist:${JSON.stringify(artist)}`,
        year ? `date:${year}` : null,
      ].filter(Boolean).join(" AND ");
      const payload = await request("release", { query, limit: Math.min(Math.max(limit, 1), 10) });
      return (payload?.releases || []).map(releaseSummary).filter(Boolean);
    },
    async getRelease(id) {
      if (!UUID_PATTERN.test(String(id))) throw new Error("MusicBrainz release ID is invalid.");
      const release = await request(`release/${id}`, { inc: "artist-credits+release-groups+labels+genres" });
      return release ? releaseSummary(release) : null;
    },
  };
}

export const MUSICBRAINZ_USER_AGENT_EXAMPLE = DEFAULT_USER_AGENT;
