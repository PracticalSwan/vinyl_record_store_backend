# Backend Data Model

This document distinguishes the default in-memory catalog seed, the active versioned MongoDB dataset, implemented persistence models, and customer-state boundaries.

The seed remains the no-database default. Explicit `CATALOG_DATA_SOURCE=mongodb` selection follows the single active `DatasetImport`; if none is active, the MongoDB repository uses the preserved 116-record legacy catalog. The current active dataset is immutable `amazon-reviews-2023-cds-vinyl-5core-v3` with 2,305 products; v2 is the immediate rollback release, and v1 remains the identity/legacy base.

## Current Demo Product

The active seed in `src/data/records.js` contains:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | number | Stable demo identifier. |
| `title`, `artist`, `genre`, `label` | string | Catalog and similarity metadata. |
| `year` | number | Release/pressing context and decade match. |
| `price` | number | Current USD demo price. |
| `stock` | `in`, `low`, or `out` | Availability and ranking preference. |
| `condition`, `format`, `pressing`, `description` | string | Display metadata. |
| `reason` | string | Legacy seed fixture only; removed from public product responses. |

Legacy public products add `currency: "USD"`, the compatibility `imageUrl`, and a nullable structured `image` envelope. Dataset-owned products may also leave artist, price, currency, stock, condition, format, genre, year, label, pressing, and description unset. Clients render explicit fallbacks and block purchase when price or stock is unknown.

## Current Synthetic Profile

The recommender contains one code-defined `demo-user` profile with purchased IDs, wishlist IDs, and preferred genres. It is not private or persistent user data.

## Implemented MongoDB Models

| Collection | Current model boundary |
| --- | --- |
| `users` | Stable public identity, normalized unique username, role, versioned preferences, active state, and non-selected password fields. |
| `vinylRecords` | Stable numeric public ID and slug, nullable source-aware store fields, dynamic genres/formats, MusicBrainz identifiers where reviewed, field origins, quality flags, provenance, source/version ownership, stock, and soft deletion. |
| `interactions` | Unique event identity, optional user or anonymous subject, product/recommendation context, event times, and 90-day expiry. |
| `wishlists`, `carts`, `ratings` | One list per user, unique cart/list product IDs, and one integer rating per user/product. |
| `guestMerges` | Unique user/merge receipt, stable input hash, and original merge result for retry-safe guest-state migration. |
| `orders` | Numeric public ID and immutable demo order snapshots; never payment data. |
| `recommendationLogs` | Unique request/list identity, safe subject, ordered products/scores/ranks/reasons, exclusions, mode, version, surface, and 90-day expiry. |
| `auditLogs` | Safe administrator change summaries without credentials or session values. |
| `counters` | Atomic numeric ID allocation. |
| `datasetImports` | Unique dataset key, pinned source/version, source and staging file hashes, configuration digest, pseudonym-key fingerprint, counts, lifecycle state, and the single active pointer. |
| `datasetProducts` | Immutable research-catalog rows with stable public identity, exact record digests, nullable commerce fields, source/field provenance, quality flags, and accepted artwork metadata where available. |
| `historicalAmazonRatings` | Versioned HMAC-pseudonymous subject key, canonical product ID, hashed external item key, rating, source time, train/validation/test split, source row, and quality flags. |

Schemas use strict unknown-field rejection, timestamps, bounded fields, enum validation, unique constraints, compound query indexes, and TTL indexes where retention applies. Public API products expose numeric `id`, never MongoDB `_id`.

## Migration And Index Boundary

`npm run db:seed` plans creates, updates, unchanged records, and conflicts without writing. `npm run db:seed:apply` first creates the catalog indexes, refuses conflicts, performs only seed-owned creates/updates in a transaction, and never deletes records. `npm run db:indexes` verifies all declared indexes; `npm run db:indexes:ensure` creates declared collections and indexes additively before verification.

Authentication, interaction ingestion, preferences, wishlist/cart state, ratings, guest-merge receipts, recommendation-request logging, catalog import, administrator catalog mutations, offline evaluation outputs, and registered-customer deletion are active. Ratings create safe history events; account deletion transactionally removes the customer and owned state, interactions, logs, and merge receipts. Backend order APIs remain deferred.

Catalog import is separate from seed migration. Seed reconciliation manages the committed reviewed MusicBrainz IDs, artwork, and provenance for seed-owned records while preserving immutable public IDs/slugs and soft-delete tombstones. `src/data/localArtworkManifest.js` binds those legacy public IDs to verified files. `src/data/datasetLocalArtworkManifest.js` separately binds only accepted dataset enrichment decisions; ambiguous and unresolved dataset rows, ordinary imports, and administrator-created records use the generic placeholder unless a reviewed local bundle includes them. Import batches validate before planning, preserve source ownership, allocate numeric IDs atomically, and default to all-or-nothing writes.

The external dataset pipeline is separate from both flows. It verifies pinned raw-source and staging hashes, a committed stable identity registry, exact per-record digests, and the reviewed artwork-decision manifest. Each version writes immutable rows to `datasetProducts`, seals the inactive import only after exact-set verification, and activates only through a transaction. Activation and rollback never delete v1, v2, v3, the legacy catalog, or customer state. Dataset-managed records are read-only in the Admin GUI. Amazon images remain excluded; accepted Cover Art Archive bindings use their verified local fallback and all other rows use the generic placeholder.

## Privacy Boundary

Do not add real emails, orders, ratings, interaction histories, or identifiers to the demo seed. Registered usernames and activity are privacy-sensitive; raw private interaction logs, password material, cookies, internal identifiers, source reviewer IDs, historical pseudonyms, and historical rating rows must never be returned by public routes. Historical subjects are not `User` documents and never merge with the three showcase customers.

## Planned Models (Personalization Roadmap)

The following are planned in `PERSONALIZATION_IMPLEMENTATION_PLAN.md` (PERS-03 / BFP-10 onward), scheduled after BFP-07, FFP-07, and FFP-08. None is implemented.

- `feedback` collection: durable explicit user feedback (`userPublicId`, `productPublicId`, `kind` of `not-interested`/`already-own`/`show-fewer-like-this`, optional `scope`/`reason`, timestamps, `schemaVersion`), unique on `(userPublicId, productPublicId, kind)`, not TTL-limited. It is the authoritative source for suppression and is removed by the existing account-deletion transaction.
- A recomputed recommendation-profile domain (not persisted): explicit preferences, explicit feedback, strong/weak implicit behavior, and operational state, assembled per request with provenance, polarity, level, weight, confidence, and recency. Passive analytics remain TTL-limited and honor the tracking opt-out; explicit functional actions persist and feed the profile regardless of opt-out.
- Additive aggregation indexes for popularity ranking (PERS-07). No destructive migration; no schema change to existing collections except the additive `feedback` collection and indexes.
