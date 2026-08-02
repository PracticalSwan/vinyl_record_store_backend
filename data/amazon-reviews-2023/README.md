# Amazon Reviews 2023 local data boundary

Only the source manifest, transformation configuration, aggregate data-quality
summary, and documentation are committed. `raw/` and `staging/` are ignored
because the publisher has not granted a dataset license and because historical
reviewer identifiers are sensitive. The pipeline ingests only the official
rating-only 5-core CSV and product metadata. It does not ingest review titles,
review bodies, reviewer profiles, or downloaded product images.

Canonical store price/currency, stock, and condition remain `null`. The broad
format is `Vinyl`; the transformer does not infer LP/EP/single/diameter/box-set
details. Amazon reference-price coverage is profiled but is not presented as a
Groovehaus selling price.

The committed manifest pins the source revision, URLs, byte counts, and SHA-256
digests. `transformation-config.json` pins the deterministic subset, deduplication,
split, and privacy policy. Run `npm run dataset:profile` before staging or
importing. Staged files contain HMAC-pseudonymized reviewer keys, not source
reviewer identifiers. The import verifies both source-derived staging hashes and
the committed configuration digest before any database write.
