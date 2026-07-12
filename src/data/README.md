# Catalog Data

`records.js` owns the approved store metadata. `artworkManifest.js` is the generated, human-reviewed mapping from every public ID to a MusicBrainz release/release-group identity and approved Cover Art Archive hotlink. `catalogRecords.js` combines both sources for seed mode and Atlas migration while preserving immutable legacy slugs for corrected titles.

Run `npm run catalog:artwork:propose` to produce the ignored review report and gallery. Only after visual review should `npm run catalog:artwork:build` replace the committed manifest. Both seed and MongoDB repositories normalize the combined records through `src/repositories/catalogMapping.js` and omit seed-only reasons from public responses.

Do not add scraped, copied, private, or unlicensed product data.
