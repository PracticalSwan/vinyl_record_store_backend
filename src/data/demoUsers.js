// Committed, non-secret classroom showcase accounts. The passwords below are
// intentionally public (they are documented in the frontend README) because
// these are shared demo logins for the showcase, not real credentials. The seed
// script (`scripts/seed-demo-users.mjs`) runs each password through scrypt
// before storing, so only the hash is persisted in MongoDB, never the plaintext.
//
// Each shared account has a small canonical role profile for the classroom
// demonstration. The referenced products are stable, visible v3 records whose
// committed metadata is repeated here only as human-reviewable seed evidence.
// These fixtures demonstrate implemented behavior; they are not quality data.

export const DEMO_USERS = [
  {
    publicId: "demo-jazz",
    username: "jazzlistener",
    displayName: "Jazz Listener",
    password: "jazz-groove-2026",
    personalization: {
      role: "jazz_listener",
      preferences: {
        favoriteGenres: ["Jazz"],
        favoriteArtists: ["Miles Davis", "John Coltrane"],
        formats: ["Vinyl"],
      },
      ratings: [
        { productPublicId: 197349, rating: 5, title: "'Round About Midnight", artist: "Miles Davis", genre: "Jazz" },
        { productPublicId: 237174, rating: 5, title: "Blue Train Limited Blue", artist: "John Coltrane", genre: "Jazz" },
        { productPublicId: 228054, rating: 4, title: "Moanin'", artist: "Art Blakey Art Blakey and the Jazz Messengers", genre: "Jazz" },
      ],
      wishlist: [
        { productPublicId: 138975, title: "Idle Moments", artist: "Grant Green", genre: "Jazz" },
        { productPublicId: 313294, title: "Song For My Father Blue Note Classic Series", artist: "Horace Silver", genre: "Jazz" },
      ],
    },
  },
  {
    publicId: "demo-rock",
    username: "rockcollector",
    displayName: "Rock Collector",
    password: "rock-groove-2026",
    personalization: {
      role: "rock_collector",
      preferences: {
        favoriteGenres: ["Rock"],
        favoriteArtists: ["Queen", "Led Zeppelin"],
        formats: ["Vinyl"],
      },
      ratings: [
        { productPublicId: 115409, rating: 5, title: "A Night at the Opera", artist: "Queen", genre: "Rock" },
        { productPublicId: 109058, rating: 5, title: "Sabbath Bloody Sabbath", artist: "Black Sabbath", genre: "Rock" },
        { productPublicId: 101041, rating: 4, title: "Led Zeppelin II Box", artist: "Led Zeppelin", genre: "Rock" },
      ],
      wishlist: [
        { productPublicId: 127211, title: "MTV Unplugged in New York", artist: "Nirvana", genre: "Rock" },
        { productPublicId: 131922, title: "The Colour And The Shape", artist: "Foo Fighters", genre: "Rock" },
      ],
    },
  },
  {
    publicId: "demo-soul",
    username: "soulseeker",
    displayName: "Soul Seeker",
    password: "soul-groove-2026",
    personalization: {
      role: "soul_seeker",
      preferences: {
        favoriteGenres: ["Soul"],
        favoriteArtists: ["Al Green", "Otis Redding"],
        formats: ["Vinyl"],
      },
      ratings: [
        { productPublicId: 146458, rating: 5, title: "I'm Still in Love with You", artist: "Al Green", genre: "Soul" },
        { productPublicId: 593545, rating: 5, title: "Otis Blue/Otis Redding Sings Soul", artist: "Otis Redding", genre: "Soul" },
        { productPublicId: 773812, rating: 4, title: "Live At Carnegie Hall", artist: "Bill Withers", genre: "Soul" },
      ],
      wishlist: [
        { productPublicId: 832536, title: "Let's Stay Together", artist: "Al Green", genre: "Soul" },
        { productPublicId: 832745, title: "The Dock Of The Bay", artist: "Otis Redding", genre: "Soul" },
      ],
    },
  },
];

// Lowercased usernames used by the register service to reserve these names so a
// visitor cannot claim a showcase identity. The unique index on
// normalizedUsername is the hard guarantee; this gives a cleaner "reserved"
// message before any hashing work.
export const DEMO_USER_USERNAMES = DEMO_USERS.map((user) => user.username.toLowerCase());
export const DEMO_USER_PUBLIC_IDS = DEMO_USERS.map((user) => user.publicId);
