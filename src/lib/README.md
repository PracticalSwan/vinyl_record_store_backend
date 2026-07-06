# Backend Library

- `errors.js`: typed service errors.
- `http.js`: common JSON envelopes.
- `request.js`: exact mutation-origin, bounded JSON, and allowed-key checks.
- `auth/`: scrypt passwords, signed sessions/cookies, and authorization. `interactionCap.js`: per-identity bounding of interaction ingestion.
- `catalog/`: import parsing, normalization, validation, and duplicate detection.
- `external/`: cached, rate-limited MusicBrainz and Cover Art Archive clients.
- `recommender/`: scoring, dataset construction, leakage checks, and metric helpers.
- `db/`: server-only MongoDB connection, catalog data-source selection, and seed-migration planning.
