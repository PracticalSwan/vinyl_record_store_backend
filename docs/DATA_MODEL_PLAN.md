# Backend Data Model Plan

This file plans MongoDB Atlas collections for backend implementation. It does not define working database code.

## Planned Collections

- `users`
- `vinylRecords`
- `artists`
- `genres`
- `interactions`
- `orders`
- `wishlists`
- `recommendationLogs`
- `designReferences`, only if approved design research notes need storage

## users

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | ObjectId | MongoDB ID. |
| `name` | string | Display name. |
| `email` | string | Unique if authentication is added. |
| `role` | string | `customer` or `admin`. |
| `favoriteGenres` | string[] | Optional onboarding data. |
| `createdAt` | date | Created timestamp. |
| `updatedAt` | date | Updated timestamp. |

## vinylRecords

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | ObjectId | MongoDB ID. |
| `title` | string | Product title. |
| `artistId` | ObjectId | Link to `artists`. |
| `album` | string | Album name. |
| `genreIds` | ObjectId[] | Links to `genres`. |
| `subgenres` | string[] | Specific styles. |
| `label` | string | Record label. |
| `releaseYear` | number | Original or pressing year. |
| `releaseEra` | string | Example: `1970s`. |
| `country` | string | Country of release or pressing. |
| `tags` | string[] | Search and recommendation tags. |
| `mood` | string[] | Optional mood descriptors. |
| `format` | string | LP, EP, single, box set. |
| `condition` | string | Item condition. |
| `price` | number | Store price. |
| `currency` | string | Example: `USD` or `THB`. |
| `stock` | number | Quantity available. |
| `imageUrl` | string | Local or approved asset URL. |
| `createdAt` | date | Created timestamp. |
| `updatedAt` | date | Updated timestamp. |

## artists

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | ObjectId | MongoDB ID. |
| `name` | string | Artist name. |
| `genres` | string[] | Main genres. |
| `relatedArtistIds` | ObjectId[] | Manual or learned links later. |
| `country` | string | Optional. |
| `activeYears` | string | Optional display field. |

## genres

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | ObjectId | MongoDB ID. |
| `name` | string | Genre or subgenre name. |
| `parentGenreId` | ObjectId | Optional parent. |
| `description` | string | Short explanation. |

## interactions

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | ObjectId | MongoDB ID. |
| `userId` | ObjectId | Link to `users`. |
| `recordId` | ObjectId | Link to `vinylRecords`. |
| `type` | string | `view`, `wishlist`, `cart`, `purchase`, `rating`, `like`, `dislike`, or `search`. |
| `value` | number or string | Rating value or search query when needed. |
| `createdAt` | date | Interaction time. |
| `metadata` | object | Optional context, such as source page. |

## orders

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | ObjectId | MongoDB ID. |
| `userId` | ObjectId | Link to `users`. |
| `items` | object[] | Record IDs, quantity, and price at time of order. |
| `status` | string | Planned order state. |
| `total` | number | Order total. |
| `createdAt` | date | Order time. |

## wishlists

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | ObjectId | MongoDB ID. |
| `userId` | ObjectId | Link to `users`. |
| `recordIds` | ObjectId[] | Saved records. |
| `createdAt` | date | Created timestamp. |
| `updatedAt` | date | Updated timestamp. |

## recommendationLogs

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | ObjectId | MongoDB ID. |
| `userId` | ObjectId | Optional user. |
| `sourceRecordId` | ObjectId | Optional source product. |
| `recommendedRecordIds` | ObjectId[] | Ordered output. |
| `scores` | object[] | Optional score details. |
| `reasons` | object[] | Explanation reasons. |
| `algorithmVersion` | string | Version label. |
| `createdAt` | date | Log time. |

## Indexing Ideas

- `users.email`, unique if authentication is added.
- `vinylRecords.artistId`.
- `vinylRecords.genreIds`.
- `vinylRecords.releaseYear`.
- `vinylRecords.tags`.
- `vinylRecords.stock`.
- `interactions.userId`.
- `interactions.recordId`.
- `orders.userId`.
- `recommendationLogs.userId`.
- `recommendationLogs.createdAt`.

## Privacy Notes

- User email and interaction history are sensitive.
- Do not commit real user data.
- Do not expose raw private interaction logs to the frontend.
- Store only the data needed for recommendation and evaluation.

## Documentation Update Rules

Update this file whenever backend collections, fields, indexes, relationships, privacy rules, or migration plans change. Update frontend data-shape docs if API responses change.
