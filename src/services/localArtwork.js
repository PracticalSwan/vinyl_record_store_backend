import { localArtworkManifest } from "../data/localArtworkManifest.js";

const PUBLIC_ID_PATTERN = /^[1-9][0-9]{0,9}$/;
const FILENAME_PATTERN = /^[1-9][0-9]*\.[0-9a-f]{12}\.jpg$/;

function failure(status, code, message) {
  return { ok: false, status, code, message };
}
function manifestIndex(manifest) {
  const index = new Map();
  for (const entry of manifest) {
    const id = String(entry.publicId);
    if (!PUBLIC_ID_PATTERN.test(id) || !FILENAME_PATTERN.test(String(entry.filename)) || index.has(id)) {
      throw new Error("The generated local artwork manifest is invalid.");
    }
    index.set(id, entry);
  }
  return index;
}

const sharedIndex = manifestIndex(localArtworkManifest);

export function createLocalArtworkRedirect(publicId, { manifest = localArtworkManifest } = {}) {
  const value = typeof publicId === "string" ? publicId : "";
  if (!PUBLIC_ID_PATTERN.test(value)) {
    return failure(400, "ARTWORK_ID_INVALID", "Artwork ID must be a canonical positive integer.");
  }

  const index = manifest === localArtworkManifest ? sharedIndex : manifestIndex(manifest);
  const entry = index.get(value);
  if (!entry) return failure(404, "ARTWORK_NOT_FOUND", "Local artwork was not found.");

  return {
    ok: true,
    status: 307,
    location: `/artwork/${entry.filename}`,
    headers: {
      "Cache-Control": "public, max-age=300, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  };
}
