# Services

`catalog.js` owns product lookup, validated catalog-query parsing, pagination metadata, and repository selection. Route handlers should not duplicate this logic.

`catalogImport.js` owns catalog validation/enrichment orchestration, conflict-aware preview planning, source ownership, stable provenance, atomic ID allocation, and transaction-backed apply behavior. Operator scripts must preview before apply.

`auth.js` owns registered/seeded login, registration, safe session subjects, and timing-equivalent missing-account work. `userState.js` owns profiles/preferences, interactions, wishlist, cart, ratings, and guest merge. `account.js` owns the restricted registered-customer deletion flow.

Search is a case-insensitive literal substring over title, artist, genre, and label. Repeated genre, condition, and era values use OR semantics within a facet and AND semantics across facets. Sorts use numeric public IDs as deterministic tie-breakers.
