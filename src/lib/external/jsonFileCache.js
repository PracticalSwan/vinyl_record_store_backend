import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1_000;

const filenameFor = (key) => `${createHash("sha256").update(key).digest("hex")}.json`;

export function createJsonFileCache({
  directory = path.resolve(".cache", "catalog-enrichment"),
  ttlMs = DEFAULT_TTL_MS,
  now = () => Date.now(),
} = {}) {
  return {
    async get(key) {
      try {
        const value = JSON.parse(await readFile(path.join(directory, filenameFor(key)), "utf8"));
        return now() - Date.parse(value.cachedAt) <= ttlMs ? value.payload : null;
      } catch (error) {
        if (error?.code === "ENOENT" || error instanceof SyntaxError) return null;
        throw error;
      }
    },
    async set(key, payload) {
      await mkdir(directory, { recursive: true });
      const destination = path.join(directory, filenameFor(key));
      const temporary = `${destination}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify({ cachedAt: new Date(now()).toISOString(), payload }), "utf8");
      try {
        await rename(temporary, destination);
      } catch (error) {
        if (!["EEXIST", "EPERM"].includes(error?.code)) throw error;
        await rm(destination, { force: true });
        await rename(temporary, destination);
      }
    },
  };
}
