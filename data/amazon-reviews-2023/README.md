# Amazon Reviews 2023 local data boundary

Only the source manifest, transformation configuration, stable product-identity
registry, reviewed artwork-enrichment decisions, aggregate data-quality summary,
and documentation are committed. `raw/` and `staging/` are ignored
because the publisher has not granted a dataset license and because historical
reviewer identifiers are sensitive. The pipeline ingests only the official
rating-only 5-core CSV and product metadata. It does not ingest review titles,
review bodies, reviewer profiles, or Amazon product images.

Canonical store price/currency, stock, and condition remain `null`. The broad
format is `Vinyl`; the transformer does not infer LP/EP/single/diameter/box-set
details. Amazon reference-price coverage is profiled but is not presented as a
Groovehaus selling price.

The committed manifest pins the source revision, URLs, byte counts, and SHA-256
digests. `transformation-config.json` pins the deterministic subset, deduplication,
split, privacy, research-only storefront, and MusicBrainz enrichment policies.
`product-identity-registry.json` preserves the v1 numeric public IDs without
committing Amazon identifiers or titles. `artwork-enrichment-v2.json` records one
accepted, ambiguous, unresolved, or failed decision for every staged product;
accepted Cover Art Archive images have a separately verified local fallback under
`public/artwork/dataset/` (208 accepted files in the verified v2 release; 6
ambiguous, 2,091 unresolved, and 0 error decisions remain placeholders).

Run `npm.cmd run dataset:profile` before staging or importing. Staged files contain
HMAC-pseudonymized reviewer keys, not source reviewer identifiers. The v2 import
verifies source and staging hashes, record digests, the identity registry, the
artwork decision manifest, and immutable dataset-key ownership before any
activation.
