// Committed, non-secret classroom showcase accounts. The passwords below are
// intentionally public (they are documented in the frontend README) because
// these are shared demo logins for the showcase, not real credentials. The seed
// script (`scripts/seed-demo-users.mjs`) runs each password through scrypt
// before storing, so only the hash is persisted in MongoDB, never the plaintext.
//
// Preferences are intentionally EMPTY in the seeded showcase fixtures. The
// optional preference-profile branch can honor saved customer preferences, but
// these shared accounts remain neutral demonstrations and are not quality
// evidence.

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
export const DEMO_USER_PUBLIC_IDS = DEMO_USERS.map((user) => user.publicId);
