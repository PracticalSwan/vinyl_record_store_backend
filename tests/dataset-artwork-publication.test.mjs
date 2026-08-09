import assert from "node:assert/strict";
import {
  link,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assertDatasetArtworkDirectory,
  cleanupStaleDatasetArtwork,
  publishContentAddressedDatasetArtwork,
  publishDatasetArtworkManifest,
  renderDatasetArtworkManifest,
  verifyDatasetArtworkPublication,
  writeTextAtomically,
} from "../src/lib/dataset/datasetArtworkPublication.js";
import {
  inspectLocalArtworkBytes,
  localArtworkFilename,
} from "../src/lib/external/localArtworkAssets.js";

const VALID_JPEG = Buffer.from([
  0xff, 0xd8,
  0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00,
  0xff, 0xd9,
]);
const SOURCE_DIGEST = "a".repeat(64);

function fixture(publicId = 100001) {
  const inspected = inspectLocalArtworkBytes(VALID_JPEG, { contentType: "image/jpeg" });
  const filename = localArtworkFilename(publicId, inspected.sha256);
  const accepted = {
    publicId,
    musicBrainzReleaseId: "11111111-1111-4111-8111-111111111111",
    musicBrainzReleaseGroupId: "22222222-2222-4222-8222-222222222222",
    artwork: {
      thumbnailUrl: "https://coverartarchive.org/example-500.jpg",
      sourceUrl: "https://musicbrainz.org/release/11111111-1111-4111-8111-111111111111",
    },
  };
  return {
    accepted,
    entry: {
      publicId,
      filename,
      assetPath: `/artwork/dataset/${filename}`,
      sourceUrl: accepted.artwork.thumbnailUrl,
      finalUrl: "https://archive.org/example.jpg",
      sourcePageUrl: accepted.artwork.sourceUrl,
      musicBrainzReleaseId: accepted.musicBrainzReleaseId,
      musicBrainzReleaseGroupId: accepted.musicBrainzReleaseGroupId,
      ...inspected,
      retrievedAt: "2026-08-08T00:00:00.000Z",
      sourceManifestSha256: SOURCE_DIGEST,
    },
  };
}

test("production candidate validation tolerates stale files but strict validation rejects them", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "dataset-art-candidate-"));
  try {
    const { entry, accepted } = fixture();
    await writeFile(path.join(root, entry.filename), VALID_JPEG);
    await writeFile(path.join(root, "999999.aaaaaaaaaaaa.jpg"), VALID_JPEG);
    await assert.doesNotReject(() => verifyDatasetArtworkPublication({
      entries: [entry], accepted: [accepted], sourceManifestSha256: SOURCE_DIGEST,
      assetDirectory: root, boundaryRoot: root, exactDirectory: false,
    }));
    await assert.rejects(() => verifyDatasetArtworkPublication({
      entries: [entry], accepted: [accepted], sourceManifestSha256: SOURCE_DIGEST,
      assetDirectory: root, boundaryRoot: root, exactDirectory: true,
    }), /orphan JPEG/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("failure before atomic rename leaves the old manifest intact", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "dataset-art-atomic-"));
  try {
    const manifestPath = path.join(root, "manifest.js");
    await writeFile(manifestPath, "old manifest\n", "utf8");
    await assert.rejects(() => writeTextAtomically(manifestPath, "new manifest\n", {
      beforeRename: async () => { throw new Error("simulated interruption"); },
    }), /simulated interruption/);
    assert.equal(await readFile(manifestPath, "utf8"), "old manifest\n");
    assert.deepEqual((await readdir(root)).sort(), ["manifest.js"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("failure after manifest swap leaves a complete new manifest and the next run converges", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "dataset-art-converge-"));
  try {
    const assetDirectory = path.join(root, "dataset");
    const legacyDirectory = path.join(root, "legacy");
    const manifestPath = path.join(root, "manifest.js");
    await mkdir(assetDirectory);
    await mkdir(legacyDirectory);
    await writeFile(path.join(legacyDirectory, "legacy.jpg"), VALID_JPEG);
    const { entry, accepted } = fixture();
    await writeFile(path.join(assetDirectory, entry.filename), VALID_JPEG);
    await writeFile(path.join(assetDirectory, "999999.aaaaaaaaaaaa.jpg"), VALID_JPEG);
    await writeFile(path.join(assetDirectory, "STALE.JPG"), VALID_JPEG);
    await writeFile(manifestPath, "old manifest\n", "utf8");
    await assert.rejects(() => publishDatasetArtworkManifest({
      entries: [entry], accepted: [accepted], sourceManifestSha256: SOURCE_DIGEST,
      assetDirectory, boundaryRoot: root, manifestPath,
      afterManifestSwap: async () => { throw new Error("simulated post-swap interruption"); },
    }), /post-swap interruption/);
    assert.equal(
      await readFile(manifestPath, "utf8"),
      renderDatasetArtworkManifest([entry], SOURCE_DIGEST),
    );
    assert.equal((await readdir(assetDirectory)).includes("999999.aaaaaaaaaaaa.jpg"), true);
    const result = await publishDatasetArtworkManifest({
      entries: [entry], accepted: [accepted], sourceManifestSha256: SOURCE_DIGEST,
      assetDirectory, boundaryRoot: root, manifestPath,
    });
    assert.deepEqual(result.removed.sort(), ["999999.aaaaaaaaaaaa.jpg", "STALE.JPG"]);
    assert.deepEqual(await readdir(legacyDirectory), ["legacy.jpg"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("content-address collision fails closed and identical content is reused", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "dataset-art-collision-"));
  try {
    const { entry } = fixture();
    const destination = path.join(root, entry.filename);
    const stagedConflict = path.join(root, "staged-conflict.jpg");
    await writeFile(destination, VALID_JPEG);
    await writeFile(stagedConflict, VALID_JPEG);
    await assert.rejects(() => publishContentAddressedDatasetArtwork(stagedConflict, destination, {
      expectedSha256: "0".repeat(64),
    }), /conflicts/);
    const stagedReuse = path.join(root, "staged-reuse.jpg");
    await writeFile(stagedReuse, VALID_JPEG);
    assert.equal(await publishContentAddressedDatasetArtwork(stagedReuse, destination, {
      expectedSha256: entry.sha256,
    }), "reused");
    await assert.rejects(() => readFile(stagedReuse), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("stale hard links are unlinked without touching their outside target", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "dataset-art-hardlink-"));
  try {
    const assetDirectory = path.join(root, "dataset");
    await mkdir(assetDirectory);
    const outside = path.join(root, "outside.jpg");
    const stale = path.join(assetDirectory, "999999.bbbbbbbbbbbb.jpg");
    await writeFile(outside, VALID_JPEG);
    await link(outside, stale);
    assert.deepEqual(
      await cleanupStaleDatasetArtwork(assetDirectory, new Set(), { boundaryRoot: root }),
      [path.basename(stale)],
    );
    assert.deepEqual(await readFile(outside), VALID_JPEG);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("referenced symlink artwork is rejected when the platform permits symlink creation", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "dataset-art-symlink-"));
  try {
    const { entry, accepted } = fixture();
    const outside = path.join(root, "outside.jpg");
    const assetDirectory = path.join(root, "dataset");
    await mkdir(assetDirectory);
    await writeFile(outside, VALID_JPEG);
    try {
      await symlink(outside, path.join(assetDirectory, entry.filename), "file");
    } catch (error) {
      if (["EPERM", "EACCES"].includes(error.code)) {
        t.skip("File symlink creation is not permitted in this Windows session.");
        return;
      }
      throw error;
    }
    await assert.rejects(() => verifyDatasetArtworkPublication({
      entries: [entry], accepted: [accepted], sourceManifestSha256: SOURCE_DIGEST,
      assetDirectory, boundaryRoot: root, exactDirectory: false,
    }), /regular file/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("dataset artwork root rejects a symlink or junction before publication", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "dataset-art-root-link-"));
  try {
    const realDirectory = path.join(root, "real-dataset");
    const linkedDirectory = path.join(root, "linked-dataset");
    await mkdir(realDirectory);
    try {
      await symlink(realDirectory, linkedDirectory, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (["EPERM", "EACCES"].includes(error.code)) {
        t.skip("Directory link creation is not permitted in this session.");
        return;
      }
      throw error;
    }
    await assert.rejects(
      () => assertDatasetArtworkDirectory(linkedDirectory, { boundaryRoot: root }),
      /real directory/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("dataset artwork rejects an ancestor junction even when the final directory is real", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "dataset-art-ancestor-link-"));
  try {
    const repositoryRoot = path.join(root, "repo");
    const publicDirectory = path.join(repositoryRoot, "public");
    const outsideArtwork = path.join(root, "outside-artwork");
    const outsideDataset = path.join(outsideArtwork, "dataset");
    await mkdir(publicDirectory, { recursive: true });
    await mkdir(outsideDataset, { recursive: true });
    const linkedArtwork = path.join(publicDirectory, "artwork");
    try {
      await symlink(outsideArtwork, linkedArtwork, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (["EPERM", "EACCES"].includes(error.code)) {
        t.skip("Directory link creation is not permitted in this session.");
        return;
      }
      throw error;
    }
    await assert.rejects(
      () => assertDatasetArtworkDirectory(path.join(linkedArtwork, "dataset"), { boundaryRoot: repositoryRoot }),
      /traverses a symbolic link or junction/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
