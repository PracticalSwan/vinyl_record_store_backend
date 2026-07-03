# Backend Data Model

This document distinguishes the default in-memory seed, implemented persistence models, and the still-deferred write APIs.

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

Public products add `currency: "USD"` and `imageUrl: null`.

## Current Synthetic Profile

The recommender contains one code-defined `demo-user` profile with purchased IDs, wishlist IDs, and preferred genres. It is not private or persistent user data.

## Implemented MongoDB Models

| Collection | Current model boundary |
| --- | --- |
| `users` | Stable public identity, normalized unique username, role, preferences, active state, session version, and non-selected password fields. |
| `vinylRecords` | Stable numeric public ID and slug, catalog metadata, provenance/artwork fields, stock, and soft deletion. |
| `interactions` | Unique event identity, optional user or anonymous subject, product/recommendation context, event times, and 90-day expiry. |
| `wishlists`, `carts`, `ratings` | One list per user, unique cart/list product IDs, and one integer rating per user/product. |
| `orders` | Numeric public ID and immutable demo order snapshots; never payment data. |
| `recommendationLogs` | Unique request identity, ordered results, algorithm context, and 90-day expiry. |
| `auditLogs` | Safe administrator change summaries without credentials or session values. |
| `counters` | Atomic numeric ID allocation. |

Schemas use strict unknown-field rejection, timestamps, bounded fields, enum validation, unique constraints, compound query indexes, and TTL indexes where retention applies. Public API products expose numeric `id`, never MongoDB `_id`.

## Migration And Index Boundary

`npm run db:seed` plans creates, updates, unchanged records, and conflicts without writing. `npm run db:seed:apply` first creates the catalog indexes, refuses conflicts, performs only seed-owned creates/updates in a transaction, and never deletes records. `npm run db:indexes` verifies all declared indexes; `npm run db:indexes:ensure` creates declared collections and indexes additively before verification.

The model/repository foundation does not imply that write APIs are active. Authentication, interaction ingestion, wishlist/cart sync, ratings, orders, recommendation logging, and administrator mutations remain deferred.

## Privacy Boundary

Do not add real emails, orders, ratings, interaction histories, or identifiers to the demo seed. Raw private interaction logs must never be returned by public routes.
