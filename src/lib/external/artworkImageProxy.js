import { createImageFileCache } from "./imageFileCache.js";

const DEFAULT_USER_AGENT = "GroovehausVinyl/0.1 (https://github.com/PracticalSwan/vinyl_record_store_backend)";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_SIZE_BYTES = 6 * 1024 * 1024;

// Cover Art Archive serves the image bytes; some assets 302-redirect into the
// Internet Archive. Both families are trusted and explicitly allowed as
// redirect targets, while every other host is rejected to prevent SSRF.
const ALLOWED_REQUEST_HOSTS = new Set(["coverartarchive.org", "www.coverartarchive.org"]);
const ALLOWED_REDIRECT_HOSTS = new Set([
  "coverartarchive.org",
  "www.coverartarchive.org",
  "archive.org",
  "www.archive.org",
]);

export class ArtworkProxyError extends Error {
  constructor(message, { status = 0, code = "ARTWORK_UPSTREAM_ERROR" } = {}) {
    super(message);
    this.name = "ArtworkProxyError";
    this.status = status;
    this.code = code;
  }
}

function validatedTarget(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new ArtworkProxyError("Artwork URL is malformed.", { status: 400, code: "ARTWORK_URL_INVALID" });
  }
  if (!ALLOWED_REQUEST_HOSTS.has(url.hostname.toLowerCase())) {
    // Hard SSRF boundary: only Cover Art Archive URLs may ever be fetched,
    // which also rules out localhost, private, and link-local addresses.
    throw new ArtworkProxyError("Artwork host is not permitted.", { status: 400, code: "ARTWORK_HOST_NOT_ALLOWED" });
  }
  url.protocol = "https:";
  return url;
}

function cleanContentType(value) {
  const type = String(value || "").split(";")[0].trim().toLowerCase();
  return type.startsWith("image/") ? type : null;
}

async function readBodyCapped(response, maxSizeBytes) {
  if (response.body && typeof response.body.getReader === "function") {
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxSizeBytes) {
        try {
          await reader.cancel();
        } catch {
          // Cancel is best-effort; the oversize decision has already been made.
        }
        throw new ArtworkProxyError("Artwork upstream exceeded the size limit.", {
          status: 502,
          code: "ARTWORK_TOO_LARGE",
        });
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  }
  // Test stubs and edge runtimes without a streaming body fall back here.
  const body = Buffer.from(await response.arrayBuffer());
  if (body.byteLength > maxSizeBytes) {
    throw new ArtworkProxyError("Artwork upstream exceeded the size limit.", {
      status: 502,
      code: "ARTWORK_TOO_LARGE",
    });
  }
  return body;
}

export function createArtworkImageProxy({
  fetchImpl = globalThis.fetch,
  cache = createImageFileCache(),
  userAgent = process.env.MUSICBRAINZ_USER_AGENT || DEFAULT_USER_AGENT,
  timeoutMs = REQUEST_TIMEOUT_MS,
  maxSizeBytes = MAX_SIZE_BYTES,
} = {}) {
  return {
    async fetchImage(targetUrl) {
      const url = validatedTarget(targetUrl);
      const cacheKey = `artwork-image:${url.toString()}`;

      const cached = await cache.get(cacheKey);
      if (cached?.contentType && cached.body) return cached;

      let response;
      try {
        response = await fetchImpl(url, {
          headers: { Accept: "image/*", ...(userAgent ? { "User-Agent": userAgent } : {}) },
          redirect: "follow",
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        if (error?.name === "AbortError" || error?.name === "TimeoutError") {
          throw new ArtworkProxyError("Artwork upstream did not respond in time.", {
            status: 504,
            code: "ARTWORK_UPSTREAM_TIMEOUT",
          });
        }
        throw new ArtworkProxyError(`Artwork upstream request failed: ${error?.name || "network error"}.`, {
          status: 502,
          code: "ARTWORK_UPSTREAM_UNREACHABLE",
        });
      }

      // Defense in depth: after following redirects, confirm the resolved host
      // stayed within the trusted Internet Archive family. undici always sets
      // response.url; when present we require it to parse and be allowed. An
      // absent value is tolerated only because the initial request host was
      // already pinned above.
      if (response.url) {
        let finalHost;
        try {
          finalHost = new URL(response.url).hostname.toLowerCase();
        } catch {
          finalHost = null;
        }
        if (!finalHost || !ALLOWED_REDIRECT_HOSTS.has(finalHost)) {
          throw new ArtworkProxyError("Artwork redirected to a disallowed host.", {
            status: 502,
            code: "ARTWORK_HOST_NOT_ALLOWED",
          });
        }
      }

      if (response.status === 404) {
        throw new ArtworkProxyError("Artwork was not found upstream.", { status: 404, code: "ARTWORK_NOT_FOUND" });
      }
      if (!response.ok) {
        throw new ArtworkProxyError(`Artwork upstream returned HTTP ${response.status}.`, {
          status: 502,
          code: "ARTWORK_UPSTREAM_ERROR",
        });
      }

      const contentType = cleanContentType(response.headers.get("content-type"));
      if (!contentType) {
        throw new ArtworkProxyError("Artwork upstream did not return an image.", {
          status: 502,
          code: "ARTWORK_UPSTREAM_ERROR",
        });
      }

      // AbortSignal.timeout spans the whole lifecycle, so a slow body stream
      // trips the abort inside readBodyCapped rather than around fetchImpl.
      // Re-map it here so callers see ARTWORK_UPSTREAM_TIMEOUT (not 500).
      let body;
      try {
        body = await readBodyCapped(response, maxSizeBytes);
      } catch (error) {
        if (error instanceof ArtworkProxyError) throw error;
        if (error?.name === "AbortError" || error?.name === "TimeoutError") {
          throw new ArtworkProxyError("Artwork upstream did not respond in time.", {
            status: 504,
            code: "ARTWORK_UPSTREAM_TIMEOUT",
          });
        }
        throw new ArtworkProxyError(`Artwork upstream stream failed: ${error?.name || "read error"}.`, {
          status: 502,
          code: "ARTWORK_UPSTREAM_UNREACHABLE",
        });
      }
      if (!body.byteLength) {
        throw new ArtworkProxyError("Artwork upstream returned an empty response.", {
          status: 502,
          code: "ARTWORK_UPSTREAM_ERROR",
        });
      }

      await cache.set(cacheKey, { contentType, body });
      return { contentType, body };
    },
  };
}
