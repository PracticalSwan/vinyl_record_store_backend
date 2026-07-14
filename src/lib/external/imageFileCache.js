import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1_000;

const filenameFor = (key, suffix) => `${createHash("sha256").update(key).digest("hex")}.${suffix}`;

// Windows rejects rename over an existing file with EPERM; POSIX atomically
// replaces. Retry once by removing the destination so concurrent writes to the
// same cache key resolve without surfacing an error to the caller.
async function atomicRename(source, destination) {
  try {
    await rename(source, destination);
  } catch (error) {
    if (!["EEXIST", "EPERM"].includes(error?.code)) throw error;
    await rm(destination, { force: true });
    await rename(source, destination);
  }
}

// Binary counterpart to jsonFileCache: stores image bytes alongside a small
// JSON sidecar that carries the cache timestamp and content type. The same key
// hashing scheme keeps the two caches independent on disk.
export function createImageFileCache({
  directory = path.resolve(".cache", "artwork-images"),
  ttlMs = DEFAULT_TTL_MS,
  now = () => Date.now(),
} = {}) {
  return {
    async get(key) {
      const metaPath = path.join(directory, filenameFor(key, "json"));
      const bodyPath = path.join(directory, filenameFor(key, "bin"));
      try {
        const meta = JSON.parse(await readFile(metaPath, "utf8"));
        const age = now() - Date.parse(meta.cachedAt);
        // A corrupt/missing cachedAt yields NaN; treat that as expired rather
        // than serving a stale entry indefinitely.
        if (!Number.isFinite(age) || age > ttlMs) return null;
        const body = await readFile(bodyPath);
        return { contentType: meta.contentType, body };
      } catch (error) {
        if (error?.code === "ENOENT" || error instanceof SyntaxError) return null;
        throw error;
      }
    },
    async set(key, { contentType, body }) {
      await mkdir(directory, { recursive: true });
      const metaDestination = path.join(directory, filenameFor(key, "json"));
      const bodyDestination = path.join(directory, filenameFor(key, "bin"));
      // A per-write unique suffix (not process.pid) keeps concurrent writes to
      // the same key from colliding on a shared temp file.
      const stamp = randomUUID();
      const metaTemporary = `${metaDestination}.${stamp}.tmp`;
      const bodyTemporary = `${bodyDestination}.${stamp}.tmp`;
      await writeFile(metaTemporary, JSON.stringify({ cachedAt: new Date(now()).toISOString(), contentType }), "utf8");
      await writeFile(bodyTemporary, body);
      // Rename the payload first so a half-written store can never produce a
      // meta file pointing at a missing body; get() treats a missing body
      // (ENOENT) as a miss. atomicRename tolerates a concurrent write winning
      // the destination slot on Windows (EPERM) without erroring.
      await atomicRename(bodyTemporary, bodyDestination);
      await atomicRename(metaTemporary, metaDestination);
    },
  };
}
