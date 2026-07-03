# Database Boundary

`mongodb.js` owns the server-only, cached Mongoose connection to MongoDB Atlas. `npm run db:ping` verifies authentication, network access, database selection, and a clean disconnect.

The catalog still reads `src/data/records.js`. No model, schema, collection, migration, or persistence path is active.

Keep credentials only in ignored `.env.local`. Persistence requires a separate explicit task covering models, indexes, privacy, retention, migration, and failure handling.
