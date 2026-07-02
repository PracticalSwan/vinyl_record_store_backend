# Backend Data Model

This document distinguishes the active in-memory seed from deferred persistence.

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

## Deferred MongoDB Model

Future persistence may require `users`, `vinylRecords`, `interactions`, `wishlists`, `orders`, and `recommendationLogs`, with indexes around user, record, time, genre, artist, and availability. Exact schemas and retention/privacy rules must be decided when persistence is explicitly scoped.

## Privacy Boundary

Do not add real emails, orders, ratings, interaction histories, or identifiers to the demo seed. Raw private interaction logs must never be returned by public routes.
