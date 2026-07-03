# Services

`catalog.js` owns product lookup, validated catalog-query parsing, pagination metadata, and repository selection. Route handlers should not duplicate this logic.

Search is a case-insensitive literal substring over title, artist, genre, and label. Repeated genre, condition, and era values use OR semantics within a facet and AND semantics across facets. Sorts use numeric public IDs as deterministic tie-breakers.
