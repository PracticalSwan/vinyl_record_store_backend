# Third-Party Artwork

The 116 JPEG files directly under `public/artwork/` are local availability fallbacks for the reviewed Groovehaus catalog. They were retrieved from the Cover Art Archive using the exact MusicBrainz release or release-group mappings already recorded in `src/data/artworkManifest.js`.

The v2 Amazon Reviews 2023 integration does not proxy, download, or reuse Amazon product images. It performs rate-limited MusicBrainz release searches under a strict, unique-release-group acceptance policy. Products with an accepted Cover Art Archive front image use the approved remote proxy and a verified local fallback under `public/artwork/dataset/` (208 files in the verified v2 release); ambiguous and unresolved products use the generic vinyl placeholder and never borrow a legacy image.

`src/data/localArtworkManifest.js` records the legacy bindings. `src/data/datasetLocalArtworkManifest.js` records the accepted v2 bindings. Each entry includes the public ID, source URL, resolved Internet Archive URL, MusicBrainz source page and identifiers, retrieval time, media type, byte count, pixel dimensions, SHA-256 digest, and content-addressed filename. The two verification commands validate the exact expected sets without contacting the network:

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

The downloader accepts only reviewed HTTPS Cover Art Archive inputs and validated Cover Art Archive or Internet Archive redirect hosts. It limits redirects, elapsed time, bytes, and decoded pixel count; requires complete JPEG bytes; stages the full result; publishes content-addressed files before the manifest; and leaves unrelated files untouched unless `--prune` is explicitly selected.

For the v2 research catalog, first rerun the rate-limited enrichment only when the committed source/config decision changes, then publish and verify the accepted set:

```powershell
npm.cmd run dataset:artwork:enrich
npm.cmd run dataset:artwork:download
npm.cmd run dataset:artwork:verify
```

The dataset downloader never prunes unrelated assets. It refuses stale provenance, missing accepted entries, duplicate IDs/files, invalid JPEGs, and orphan JPEGs in the dataset artwork directory.
