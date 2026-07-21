# Third-Party Artwork

The 116 JPEG files under `public/artwork/` are local availability fallbacks for the reviewed Groovehaus catalog. They were retrieved from the Cover Art Archive using the exact MusicBrainz release or release-group mappings already recorded in `src/data/artworkManifest.js`.

`src/data/localArtworkManifest.js` records each catalog public ID, source URL, resolved Internet Archive URL, MusicBrainz source page and identifiers, retrieval time, media type, byte count, pixel dimensions, SHA-256 digest, and content-addressed filename. Run `npm run catalog:artwork:verify` to require exact 116-record set equality and validate every committed file without contacting the network.

## Rights And Reuse

The repository's MIT license covers the project code and original documentation. It does not grant rights to the album-cover images. Cover Art Archive states that images remain copyrighted by their respective owners, and its public access does not guarantee permission for every reuse:

- <https://coverartarchive.org/>
- <https://musicbrainz.org/doc/Cover_Art_Archive>

The files are included for this academic CSX4207 storefront demonstration and retain source-level provenance. Anyone redistributing or reusing them must assess the applicable rights for that use. A rights holder may request correction or removal through the repository maintainers.

## Controlled Refresh

The local bundle is derived data, not an independent curation source. Update `src/data/artworkManifest.js` through the human-review workflow first, then run:

```bash
npm run catalog:artwork:download
npm run catalog:artwork:verify
```

The downloader accepts only reviewed HTTPS Cover Art Archive inputs and validated Cover Art Archive or Internet Archive redirect hosts. It limits redirects, elapsed time, bytes, and decoded pixel count; requires complete JPEG bytes; stages the full result; publishes content-addressed files before the manifest; and leaves unrelated files untouched unless `--prune` is explicitly selected.
