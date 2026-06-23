# Backend API Contract Plan

This file plans backend routes. It does not implement API code.

## API Principles

- Keep response shapes predictable.
- Validate input before using it.
- Return clear errors.
- Keep private data out of public responses.
- Version breaking changes through documentation before implementation.

## Common Response Shape

Planned success shape:

```json
{
  "data": {},
  "meta": {}
}
```

Planned error shape:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

## Planned Endpoints

### Product Listing

| Field | Plan |
| --- | --- |
| Method | `GET` |
| Path | `/api/products` |
| Purpose | Return paginated vinyl records. |
| Request shape | Query params: `page`, `limit`, `genre`, `artist`, `label`, `era`, `minPrice`, `maxPrice`, `inStock`. |
| Response shape | `{ data: { items }, meta: { page, limit, total } }` |
| Validation notes | Validate numeric page, limit, and price filters. |
| Error cases | Invalid filters, database unavailable. |
| Related collections | `vinylRecords`, `artists`, `genres` |

### Product Detail

| Field | Plan |
| --- | --- |
| Method | `GET` |
| Path | `/api/products/:id` |
| Purpose | Return one vinyl record with metadata. |
| Request shape | Product ID in path. |
| Response shape | `{ data: { product } }` |
| Validation notes | Validate product ID format. |
| Error cases | Not found, invalid ID, database unavailable. |
| Related collections | `vinylRecords`, `artists`, `genres` |

### Search And Filter

| Field | Plan |
| --- | --- |
| Method | `GET` |
| Path | `/api/search` |
| Purpose | Search records by text and filters. |
| Request shape | Query params: `q`, `genre`, `artist`, `tag`, `era`, `label`, `condition`. |
| Response shape | `{ data: { items }, meta: { query, filters, total } }` |
| Validation notes | Trim search text, limit query length, validate filters. |
| Error cases | Invalid query, database unavailable. |
| Related collections | `vinylRecords`, `artists`, `genres` |

### User Interaction Logging

| Field | Plan |
| --- | --- |
| Method | `POST` |
| Path | `/api/interactions` |
| Purpose | Record user behavior for recommendation signals. |
| Request shape | `{ userId, recordId, type, value, metadata }` |
| Response shape | `{ data: { saved: true, interactionId } }` |
| Validation notes | Validate user, record, and allowed interaction type. |
| Error cases | Invalid type, missing user, missing product, database unavailable. |
| Related collections | `interactions`, `users`, `vinylRecords` |

### Recommendation By Product

| Field | Plan |
| --- | --- |
| Method | `GET` |
| Path | `/api/recommendations/product/:id` |
| Purpose | Return records similar to one product. |
| Request shape | Product ID in path, optional `limit`. |
| Response shape | `{ data: { sourceProductId, recommendations: [{ product, score, reasons }] } }` |
| Validation notes | Validate product ID and limit. |
| Error cases | Product not found, no candidates, database unavailable. |
| Related collections | `vinylRecords`, `artists`, `genres`, `recommendationLogs` |

### Recommendation By User

| Field | Plan |
| --- | --- |
| Method | `GET` |
| Path | `/api/recommendations/user/:userId` |
| Purpose | Return recommendations based on user behavior. |
| Request shape | User ID in path, optional `limit`. |
| Response shape | `{ data: { userId, recommendations: [{ product, score, reasons }] } }` |
| Validation notes | Validate user ID and limit. |
| Error cases | User not found, no history, database unavailable. |
| Related collections | `users`, `interactions`, `orders`, `wishlists`, `vinylRecords`, `recommendationLogs` |

### Wishlist Interaction

| Field | Plan |
| --- | --- |
| Method | `POST` or `DELETE` |
| Path | `/api/wishlist/:recordId` |
| Purpose | Add or remove a record from a wishlist. |
| Request shape | User identity from future auth/session, record ID in path. |
| Response shape | `{ data: { wishlist } }` |
| Validation notes | Validate record exists and user is known. |
| Error cases | Record not found, user not found, database unavailable. |
| Related collections | `wishlists`, `interactions`, `vinylRecords` |

### Cart Interaction

| Field | Plan |
| --- | --- |
| Method | `POST` or `DELETE` |
| Path | `/api/cart/:recordId` |
| Purpose | Track add/remove cart behavior for recommendations. |
| Request shape | User identity from future auth/session, record ID in path. |
| Response shape | `{ data: { cart } }` |
| Validation notes | Validate stock and record exists. |
| Error cases | Out of stock, record not found, database unavailable. |
| Related collections | `interactions`, `vinylRecords` |

### Order-Related Interaction

| Field | Plan |
| --- | --- |
| Method | `POST` |
| Path | `/api/orders` |
| Purpose | Record planned purchase data for recommendation signals. |
| Request shape | `{ userId, items }` |
| Response shape | `{ data: { orderId, status } }` |
| Validation notes | Validate items, stock, and user. |
| Error cases | Empty order, out of stock, invalid user, database unavailable. |
| Related collections | `orders`, `interactions`, `vinylRecords` |

### Admin Product Management

| Field | Plan |
| --- | --- |
| Method | `POST`, `PATCH`, `DELETE` |
| Path | `/api/admin/products` and `/api/admin/products/:id` |
| Purpose | Optional catalog management. |
| Request shape | Product fields from `docs/DATA_MODEL_PLAN.md`. |
| Response shape | `{ data: { product } }` or `{ data: { deleted: true } }` |
| Validation notes | Validate role, required fields, price, stock, and metadata. |
| Error cases | Unauthorized, invalid payload, not found, database unavailable. |
| Related collections | `vinylRecords`, `artists`, `genres` |

## Documentation Update Notes

Update this file whenever route names, methods, request shapes, response shapes, validation, errors, or related collections change. Update the frontend API consumption docs when a contract changes.

