import { ArtworkProxyError, createArtworkImageProxy } from "../lib/external/artworkImageProxy.js";

// One shared proxy instance; its on-disk image cache persists across requests
// so repeat views do not re-hit the Cover Art Archive.
const sharedProxy = createArtworkImageProxy();

const SUCCESS_HEADERS = Object.freeze({
  "Content-Type": null, // set per response from the cached upstream content type
  "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
  "X-Content-Type-Options": "nosniff",
});

function failure(status, code, message) {
  return { ok: false, status, code, message };
}

// Maps an artwork request to a transport-neutral result the route handler can
// render into either a streamed image or a JSON error envelope. Kept free of
// Next imports so it can be unit-tested under node --test without next/server.
export async function createArtworkResponse(targetUrl, { proxy = sharedProxy } = {}) {
  if (!targetUrl) return failure(400, "ARTWORK_URL_INVALID", "Missing artwork URL.");
  try {
    const { contentType, body } = await proxy.fetchImage(targetUrl);
    return {
      ok: true,
      status: 200,
      headers: { ...SUCCESS_HEADERS, "Content-Type": contentType },
      body,
    };
  } catch (error) {
    if (error instanceof ArtworkProxyError) {
      return failure(error.status || 502, error.code || "ARTWORK_UPSTREAM_ERROR", error.message);
    }
    return failure(500, "INTERNAL_ERROR", "The backend could not complete the request.");
  }
}
