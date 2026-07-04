# Backend Library

- `errors.js`: typed service errors.
- `http.js`: common JSON envelopes.
- `request.js`: exact mutation-origin, bounded JSON, and allowed-key checks.
- `auth/`: scrypt passwords, signed sessions/cookies, and authorization. `interactionCap.js`: per-identity bounding of interaction ingestion.
- `recommender/`: scoring and metric helpers.
- `db/`: server-only MongoDB connection, catalog data-source selection, and seed-migration planning.
