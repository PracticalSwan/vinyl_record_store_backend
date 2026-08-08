# Third-Party Artwork

The 116 JPEG files directly under `public/artwork/` are local availability fallbacks for the reviewed Groovehaus catalog. They were retrieved from the Cover Art Archive using the exact MusicBrainz release or release-group mappings already recorded in `src/data/artworkManifest.js`.

The Amazon Reviews 2023 integration does not proxy, download, or reuse Amazon product images. It performs rate-limited MusicBrainz release searches under a strict, unique-release-group acceptance policy. MusicBrainz release-search omits release-group first-release-date, so the enrichment script hydrates original-release year from the authoritative release-group detail after a strict unique match. The Cover Art Archive metadata client retries bounded transient failures (network errors, 429, 5xx) with exponential backoff and honors Retry-After. Products with an accepted Cover Art Archive front image use the approved remote proxy and a verified local fallback under `public/artwork/dataset/` (208 files in the verified release); ambiguous and unresolved products use the generic vinyl placeholder and never borrow a legacy image.

`src/data/localArtworkManifest.js` records the legacy bindings. `src/data/datasetLocalArtworkManifest.js` records the accepted current-v3 bindings; `data/amazon-reviews-2023/local-artwork-evidence-v2.json` independently pins the stable v2 rollback set. Each entry includes the public ID, source URL, resolved Internet Archive URL, MusicBrainz source page and identifiers, retrieval time, media type, byte count, pixel dimensions, SHA-256 digest, and content-addressed filename. The verification commands validate the exact expected sets without contacting the artwork network:

```powershell
npm.cmd run catalog:artwork:verify
npm.cmd run dataset:artwork:verify
```

## Rights And Reuse

The repository's MIT license covers the project code and original documentation. It does not grant rights to the album-cover images. Cover Art Archive is a public archive and instructs users to consider the rights attached to each image; its public access does not guarantee permission for every reuse:

- <https://coverartarchive.org/>
- <https://musicbrainz.org/doc/Cover_Art_Archive>

The files are included for this academic CSX4207 storefront demonstration and retain source-level provenance. Anyone redistributing or reusing them must assess the applicable rights for that use. A rights holder may request correction or removal through the repository maintainers.

## Controlled Refresh

The local bundle is derived data, not an independent curation source. Update `src/data/artworkManifest.js` through the human-review workflow first, then run:

```powershell
npm.cmd run catalog:artwork:download
npm.cmd run catalog:artwork:verify
```

The downloader accepts only reviewed HTTPS Cover Art Archive inputs and validated Cover Art Archive or Internet Archive redirect hosts. It limits redirects, elapsed time, bytes, and decoded pixel count; requires complete JPEG bytes; stages the full result; verifies the complete candidate set before manifest publication; and removes stale dataset artwork only after the new manifest is safely written. Cleanup is bounded to the exact `public/artwork/dataset/` directory and rejects reparse points.

For the v3 research catalog, rerun the rate-limited enrichment only when intentionally reproducing the committed decision with the required cache/network configuration. An identical run leaves sealed v3 evidence unchanged; a changed result fails closed instead of overwriting it. If the pinned artifact is missing, restore it from Git rather than generating new timestamped bytes under the sealed key. Then publish and verify the accepted set:

```powershell
npm.cmd run dataset:artwork:enrich
npm.cmd run dataset:artwork:download
npm.cmd run dataset:artwork:verify
```

The dataset downloader never prunes unrelated assets. It refuses stale provenance, missing accepted entries, duplicate IDs/files, invalid JPEGs, and orphan JPEGs in the dataset artwork directory.
