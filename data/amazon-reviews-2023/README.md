# Amazon Reviews 2023 local data boundary

Only the source manifest, transformation configuration, stable product-identity
registry, versioned reviewed artwork-enrichment decisions, aggregate data-quality summary,
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
committing Amazon identifiers or titles. `artwork-enrichment-v3.json` owns the
current v3 decisions and authoritative release-group original-year hydration;
`artwork-enrichment-v2.json` remains immutable rollback evidence. Each records one
accepted, ambiguous, unresolved, or failed decision for every staged product.
Accepted Cover Art Archive images have a separately verified local fallback under
`public/artwork/dataset/` (208 files in v3); `local-artwork-evidence-v2.json` pins
the same stable set for rollback. Six ambiguous and 2,091 unresolved decisions
remain placeholders, with zero error decisions.

Both enrichment artifacts are sealed evidence. The canonical v3 enrichment
command recomputes/resumes decisions and compares their semantic digest to the
committed artifact without rewriting it. Restore a missing artifact from Git;
do not regenerate timestamped bytes under an existing sealed dataset key.
The v1-derived identity registry follows the same rule: its apply command is an
exact reproduction check and refuses missing or changed committed evidence.

Run `npm.cmd run dataset:profile` before staging or importing. Staged files contain
HMAC-pseudonymized reviewer keys, not source reviewer identifiers. The v3 import
verifies source and staging hashes, record digests, the v1-derived identity
registry, the v3 artwork decision manifest, and immutable dataset-key ownership
before any activation. The verifier applies the same exact ownership and digest
checks to v2 while v3 is active.
