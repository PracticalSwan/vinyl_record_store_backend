# Backend Data Model

This document distinguishes the default in-memory catalog seed, implemented persistence models, and active customer-state boundaries.

The seed remains the default catalog data source. Explicit `CATALOG_DATA_SOURCE=mongodb` selection uses the MongoDB catalog repository after the guarded seed migration has populated Atlas.

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

Public products add `currency: "USD"`, the compatibility `imageUrl`, and a nullable structured `image` envelope. Imported MongoDB products may leave genre, year, label, pressing, and description unset; clients render explicit fallbacks.

## Current Synthetic Profile

The recommender contains one code-defined `demo-user` profile with purchased IDs, wishlist IDs, and preferred genres. It is not private or persistent user data.

## Implemented MongoDB Models

| Collection | Current model boundary |
| --- | --- |
| `users` | Stable public identity, normalized unique username, role, versioned preferences, active state, and non-selected password fields. |
| `vinylRecords` | Stable numeric public ID and slug, required store fields, nullable descriptive metadata, MusicBrainz identifiers, release-bound artwork/provenance, stock, source ownership, and soft deletion. |
| `interactions` | Unique event identity, optional user or anonymous subject, product/recommendation context, event times, and 90-day expiry. |
| `wishlists`, `carts`, `ratings` | One list per user, unique cart/list product IDs, and one integer rating per user/product. |
| `guestMerges` | Unique user/merge receipt, stable input hash, and original merge result for retry-safe guest-state migration. |
| `orders` | Numeric public ID and immutable demo order snapshots; never payment data. |
| `recommendationLogs` | Unique request/list identity, safe subject, ordered products/scores/ranks/reasons, exclusions, mode, version, surface, and 90-day expiry. |
| `auditLogs` | Safe administrator change summaries without credentials or session values. |
| `counters` | Atomic numeric ID allocation. |

Schemas use strict unknown-field rejection, timestamps, bounded fields, enum validation, unique constraints, compound query indexes, and TTL indexes where retention applies. Public API products expose numeric `id`, never MongoDB `_id`.

## Migration And Index Boundary

`npm run db:seed` plans creates, updates, unchanged records, and conflicts without writing. `npm run db:seed:apply` first creates the catalog indexes, refuses conflicts, performs only seed-owned creates/updates in a transaction, and never deletes records. `npm run db:indexes` verifies all declared indexes; `npm run db:indexes:ensure` creates declared collections and indexes additively before verification.

Authentication, interaction ingestion, preferences, wishlist/cart state, ratings, guest-merge receipts, recommendation-request logging, catalog import, offline evaluation outputs, and registered-customer deletion are active. Ratings create safe history events; account deletion transactionally removes the customer and owned state, interactions, logs, and merge receipts. Demo orders and administrator catalog mutations remain deferred.

Catalog import is separate from the seed migration. Seed reconciliation does not manage MusicBrainz IDs, artwork, or provenance, so a seed re-run cannot erase enrichment. Import batches validate before planning, preserve source ownership, allocate numeric IDs atomically, and default to all-or-nothing writes.

## Privacy Boundary

Do not add real emails, orders, ratings, interaction histories, or identifiers to the demo seed. Registered usernames and activity are privacy-sensitive; raw private interaction logs, password material, cookies, and internal identifiers must never be returned by public routes.

## Planned Models (Personalization Roadmap)

The following are planned in `PERSONALIZATION_IMPLEMENTATION_PLAN.md` (PERS-03 / BFP-10 onward), scheduled after BFP-07, FFP-07, and FFP-08. None is implemented.

- `feedback` collection: durable explicit user feedback (`userPublicId`, `productPublicId`, `kind` of `not-interested`/`already-own`/`show-fewer-like-this`, optional `scope`/`reason`, timestamps, `schemaVersion`), unique on `(userPublicId, productPublicId, kind)`, not TTL-limited. It is the authoritative source for suppression and is removed by the existing account-deletion transaction.
- A recomputed recommendation-profile domain (not persisted): explicit preferences, explicit feedback, strong/weak implicit behavior, and operational state, assembled per request with provenance, polarity, level, weight, confidence, and recency. Passive analytics remain TTL-limited and honor the tracking opt-out; explicit functional actions persist and feed the profile regardless of opt-out.
- Additive aggregation indexes for popularity ranking (PERS-07). No destructive migration; no schema change to existing collections except the additive `feedback` collection and indexes.
