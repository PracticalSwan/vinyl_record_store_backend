// Committed, non-secret classroom showcase accounts. The passwords below are
// intentionally public (they are documented in the frontend README) because
// these are shared demo logins for the showcase, not real credentials. The seed
// script (`scripts/seed-demo-users.mjs`) runs each password through scrypt
// before storing, so only the hash is persisted in MongoDB, never the plaintext.
//
// Preferences are intentionally EMPTY for now. Distinct per-account preference
// profiles (for example a jazz listener, a rock collector, and a soul seeker)
// will be added to this list once recommender algorithm selection is unblocked
// (see docs/FUTURE_IMPLEMENTATION_PLAN.md). Keeping them empty avoids implying
// personalization that the recommender cannot honor yet, and keeps every demo
// account on a clean profile.

export const DEMO_USERS = [
  {
    publicId: "demo-jazz",
    username: "jazzlistener",
    displayName: "Jazz Listener",
    password: "jazz-groove-2026",
  },
  {
    publicId: "demo-rock",
    username: "rockcollector",
    displayName: "Rock Collector",
    password: "rock-groove-2026",
  },
  {
    publicId: "demo-soul",
    username: "soulseeker",
    displayName: "Soul Seeker",
    password: "soul-groove-2026",
  },
];

// Lowercased usernames used by the register service to reserve these names so a
// visitor cannot claim a showcase identity. The unique index on
// normalizedUsername is the hard guarantee; this gives a cleaner "reserved"
// message before any hashing work.
export const DEMO_USER_USERNAMES = DEMO_USERS.map((user) => user.username.toLowerCase());
