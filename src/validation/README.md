# Validation

`catalog.js` validates public IDs, user IDs, limits, pagination, price ranges, literal search length, booleans, sorts, and repeated controlled facet values before service or recommender work.

`auth.js` validates usernames, passwords, display names, and allowed keys. `writes.js` validates preferences, quantities, ratings, bounded versioned interaction batches, and guest-state merge payloads while rejecting PII and ownership fields.
