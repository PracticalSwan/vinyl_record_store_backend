# Database Boundary

`mongodb.js` owns the server-only, cached Mongoose connection to MongoDB Atlas. `dataSource.js` selects the seed or MongoDB catalog repository, and `seedMigration.js` plans conflict-safe seed changes.

When `MONGODB_URI` and `MONGODB_DB_NAME` are configured, the catalog uses MongoDB by default. Set `CATALOG_DATA_SOURCE=mongodb` explicitly in local environments that should always use Atlas; missing configuration or connection failures return a safe unavailable error instead of silently falling back.

Keep credentials only in ignored `.env.local`. Use `npm run db:ping`, dry-run `npm run db:seed`, confirmed `npm run db:seed:apply`, and `npm run db:indexes` or `npm run db:indexes:ensure` for the connected database. Seed migration manages reviewed external IDs, artwork, and provenance in addition to store metadata. It never deletes records, never rewrites immutable public IDs/slugs or soft-delete tombstones, and refuses conflicts.
