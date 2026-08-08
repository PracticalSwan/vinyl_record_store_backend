import { ExternalCatalogError } from "./musicBrainzClient.js";
import { createJsonFileCache } from "./jsonFileCache.js";

const API_ROOT = "https://coverartarchive.org";
const REQUEST_TIMEOUT_MS = 10_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 4;

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function parseRetryAfterMilliseconds(value, now = Date.now()) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1_000, 30_000);
  }
  const date = Date.parse(value);
  if (Number.isNaN(date)) return null;
  return Math.min(Math.max(date - now, 0), 30_000);
}

const httpsUrl = (value) => {
  if (!value) return null;
  const url = new URL(value);
  if (!["coverartarchive.org", "www.coverartarchive.org"].includes(url.hostname.toLowerCase())) {
    return null;
  }
  url.protocol = "https:";
  return url.toString();
};

const sourceUrl = (value, entity, entityId) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && ["musicbrainz.org", "www.musicbrainz.org"].includes(url.hostname.toLowerCase())
      && url.pathname === `/${entity}/${entityId}`
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

export function createCoverArtArchiveClient({
  fetchImpl = globalThis.fetch,
  sleep = pause,
  cache = createJsonFileCache(),
  userAgent = process.env.MUSICBRAINZ_USER_AGENT,
} = {}) {
  async function getArtwork(entity, entityId) {
      if (!UUID_PATTERN.test(String(entityId))) throw new Error(`Cover Art Archive ${entity} ID is invalid.`);
      const url = `${API_ROOT}/${entity}/${entityId}`;
      const cacheKey = `cover-art-archive:${url}`;
      const cached = await cache.get(cacheKey);
      if (cached?.resolvedArtwork) {
        const cachedArtwork = {
          ...cached.resolvedArtwork,
          thumbnailUrl: httpsUrl(cached.resolvedArtwork.thumbnailUrl),
          detailUrl: httpsUrl(cached.resolvedArtwork.detailUrl),
          sourceUrl: sourceUrl(cached.resolvedArtwork.sourceUrl, entity, entityId),
          retrievedAt: new Date(cached.resolvedArtwork.retrievedAt),
        };
        if (
          cachedArtwork.thumbnailUrl
          && cachedArtwork.detailUrl
          && cachedArtwork.sourceUrl
          && cachedArtwork.source === "cover-art-archive"
          && !Number.isNaN(cachedArtwork.retrievedAt.getTime())
        ) return cachedArtwork;
      }
      let payload = Array.isArray(cached?.images) ? cached : null;
      if (!payload) {
        let response;
        let networkError = null;
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
          try {
            response = await fetchImpl(url, {
              headers: {
                Accept: "application/json",
                ...(userAgent ? { "User-Agent": userAgent } : {}),
              },
              redirect: "follow",
              signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });
          } catch (error) {
            networkError = error;
            if (attempt < MAX_ATTEMPTS - 1) {
              await sleep(1_000 * (2 ** attempt));
              continue;
            }
            break;
          }
          networkError = null;
          if (response.status === 404) return null;
          if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_ATTEMPTS - 1) {
            const retryAfter = parseRetryAfterMilliseconds(response.headers?.get?.("retry-after"));
            await sleep(retryAfter ?? 1_000 * (2 ** attempt));
            continue;
          }
          break;
        }
        if (networkError) {
          throw new ExternalCatalogError(`Cover Art Archive request failed: ${networkError.name || "network error"}.`, {
            service: "cover-art-archive",
          });
        }
        if (!response.ok) {
          throw new ExternalCatalogError(`Cover Art Archive returned HTTP ${response.status}.`, {
            status: response.status,
            service: "cover-art-archive",
          });
        }
        payload = await response.json();
      }

      const image = (payload?.images || []).find((item) => item.approved && item.front);
      if (!image) return null;
      const thumbnailUrl = httpsUrl(entity === "release-group"
        ? `${API_ROOT}/${entity}/${entityId}/front-500`
        : image.thumbnails?.["500"] || image.thumbnails?.large);
      const detailUrl = httpsUrl(entity === "release-group"
        ? `${API_ROOT}/${entity}/${entityId}/front-1200`
        : image.thumbnails?.["1200"] || image.image || thumbnailUrl);
      if (!thumbnailUrl || !detailUrl) return null;
      const resolvedArtwork = {
        url: detailUrl,
        thumbnailUrl,
        detailUrl,
        source: "cover-art-archive",
        sourceUrl: sourceUrl(`https://musicbrainz.org/${entity}/${entityId}`, entity, entityId),
        retrievedAt: new Date(),
      };
      await cache.set(cacheKey, {
        resolvedArtwork: {
          ...resolvedArtwork,
          retrievedAt: resolvedArtwork.retrievedAt.toISOString(),
        },
      });
      return resolvedArtwork;
  }

  return {
    async getReleaseArtwork(releaseId) {
      return getArtwork("release", releaseId);
    },

    async getReleaseGroupArtwork(releaseGroupId) {
      return getArtwork("release-group", releaseGroupId);
    },
  };
}
