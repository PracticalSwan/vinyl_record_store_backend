export const records = [
  // ── Jazz ──────────────────────────────────────────────
  {
    id: 1, title: 'Kind of Blue', artist: 'Miles Davis', genre: 'Jazz',
    year: 1959, price: 48, stock: 'in', condition: 'NM',
    label: 'Columbia Records', format: 'LP, 33 1/3 rpm', pressing: '1980 US reissue',
    description: 'The best-selling jazz album of all time. Davis assembled a sextet featuring Coltrane, Adderley, Evans, Kelly, Chambers, and Cobb. Recorded in two sessions with minimal rehearsal, giving the album its famously unhurried, meditative quality.',
    reason: 'Recommended because you bought another jazz album.',
  },
  {
    id: 5, title: 'Sketches of Spain', artist: 'Miles Davis', genre: 'Jazz',
    year: 1960, price: 62, stock: 'in', condition: 'NM',
    label: 'Columbia Records', format: 'LP, 33 1/3 rpm', pressing: '1960 US original',
    description: 'A bold collaboration between Miles Davis and arranger Gil Evans, blending jazz with Spanish classical music. One of the most ambitious records in either discography.',
    reason: 'Recommended because you bought another record by this artist.',
  },
  {
    id: 8, title: 'A Love Supreme', artist: 'John Coltrane', genre: 'Jazz',
    year: 1965, price: 72, stock: 'in', condition: 'M',
    label: 'Impulse! Records', format: 'LP, 33 1/3 rpm', pressing: '1965 US original',
    description: "A spiritual suite in four parts, recorded in a single session in December 1964. Widely regarded as the pinnacle of Coltrane's art and one of the greatest jazz recordings ever.",
    reason: 'Recommended because you bought another record by Miles Davis.',
  },
  {
    id: 13, title: 'Time Out', artist: 'The Dave Brubeck Quartet', genre: 'Jazz',
    year: 1959, price: 40, stock: 'in', condition: 'VG+',
    label: 'Columbia Records', format: 'LP, 33 1/3 rpm', pressing: '1959 US original',
    description: 'Famous for experimenting with unusual time signatures, including the iconic 5/4 of "Take Five." It became the first jazz LP to sell a million copies.',
    reason: 'Recommended because it shares the same era and genre as records you own.',
  },
  {
    id: 14, title: 'Moanin\'', artist: 'Art Blakey and the Jazz Messengers', genre: 'Jazz',
    year: 1958, price: 58, stock: 'low', condition: 'VG+',
    label: 'Blue Note Records', format: 'LP, 33 1/3 rpm', pressing: '1958 US original',
    description: 'A hard-bop landmark led by drummer Art Blakey, with Bobby Timmons\'s title track becoming a genre-defining anthem of soulful, gospel-tinged jazz.',
    reason: 'Recommended because it shares similar tags and is in stock.',
  },
  {
    id: 15, title: 'Mingus Ah Um', artist: 'Charles Mingus', genre: 'Jazz',
    year: 1959, price: 46, stock: 'in', condition: 'NM',
    label: 'Columbia Records', format: 'LP, 33 1/3 rpm', pressing: '1959 US original',
    description: 'A sprawling tribute to jazz history from one of its most ambitious composers, swinging from gospel to bebop to free improvisation across a single record.',
    reason: 'Recommended because it shares the same era as your recent views.',
  },
  {
    id: 16, title: 'Maiden Voyage', artist: 'Herbie Hancock', genre: 'Jazz',
    year: 1965, price: 54, stock: 'in', condition: 'NM',
    label: 'Blue Note Records', format: 'LP, 33 1/3 rpm', pressing: '1965 US original',
    description: 'A concept album evoking the open sea through modal harmony and spacious, oceanic rhythms. Considered one of the finest post-bop records ever made.',
    reason: 'Recommended because you bought another jazz album.',
  },

  // ── Soul & R&B ────────────────────────────────────────
  {
    id: 2, title: 'Innervisions', artist: 'Stevie Wonder', genre: 'Soul',
    year: 1973, price: 32, stock: 'in', condition: 'VG+',
    label: 'Tamla', format: 'LP, 33 1/3 rpm', pressing: '1973 US original',
    description: 'A landmark of 1970s soul, Innervisions showcases Wonder at the peak of his creative powers. Lush synthesizers and deeply personal lyrics made this album a cultural touchstone.',
    reason: 'Recommended because it matches records in your wishlist.',
  },
  {
    id: 6, title: "What's Going On", artist: 'Marvin Gaye', genre: 'Soul',
    year: 1971, price: 38, stock: 'in', condition: 'VG+',
    label: 'Tamla', format: 'LP, 33 1/3 rpm', pressing: '1971 US original',
    description: 'A radical departure for Motown, this concept album addressed Vietnam, poverty, and ecological collapse with lush orchestral soul. A masterpiece of conscious music.',
    reason: 'Recommended because it shares the same genre and release era.',
  },
  {
    id: 9, title: 'Songs in the Key of Life', artist: 'Stevie Wonder', genre: 'Soul',
    year: 1976, price: 42, stock: 'low', condition: 'VG+',
    label: 'Tamla', format: '2xLP + EP', pressing: '1976 US original',
    description: 'A sprawling double album that captures Wonder at an almost supernatural creative peak. Two and a half years in the making, it rewards every minute of listening time.',
    reason: 'Recommended because it matches records in your wishlist.',
  },
  {
    id: 17, title: 'Exile in Godhead', artist: 'Sault', genre: 'Soul',
    year: 2022, price: 35, stock: 'in', condition: 'M',
    label: 'Forever Living Originals', format: 'LP, 33 1/3 rpm', pressing: '2022 UK original',
    description: 'A mysterious, genre-blurring collective that fuses gospel, funk, and protest soul into hypnotic, communal grooves with almost no public profile.',
    reason: 'Recommended because it shares similar tags to your wishlist.',
  },
  {
    id: 18, title: 'Let\'s Stay Together', artist: 'Al Green', genre: 'Soul',
    year: 1972, price: 30, stock: 'in', condition: 'VG+',
    label: 'Hi Records', format: 'LP, 33 1/3 rpm', pressing: '1972 US original',
    description: 'Produced by Willie Mitchell at the legendary Royal Studios, this is the quintessential Memphis soul record — warm, intimate, and effortlessly smooth.',
    reason: 'Recommended because it shares the same genre and release era.',
  },
  {
    id: 19, title: 'Aretha Arrives', artist: 'Aretha Franklin', genre: 'Soul',
    year: 1967, price: 33, stock: 'low', condition: 'VG',
    label: 'Atlantic Records', format: 'LP, 33 1/3 rpm', pressing: '1967 US original',
    description: 'Recorded at the famed FAME Studios in Muscle Shoals, this is raw, gospel-rooted soul that announced Aretha as the genre\'s defining voice.',
    reason: 'Recommended because it matches records in your wishlist.',
  },
  {
    id: 20, title: 'Voodoo', artist: "D'Angelo", genre: 'Soul',
    year: 2000, price: 40, stock: 'in', condition: 'NM',
    label: 'Virgin Records', format: '2xLP', pressing: '2000 US original',
    description: 'A slow-burning, neo-soul masterpiece built on loose, behind-the-beat grooves from the Soulquarians collective. Patient, sensual, and endlessly influential.',
    reason: 'Recommended because it has similar tags and is in stock.',
  },

  // ── Rock ──────────────────────────────────────────────
  {
    id: 7, title: 'Disintegration', artist: 'The Cure', genre: 'Rock',
    year: 1989, price: 50, stock: 'in', condition: 'NM',
    label: 'Fiction Records', format: 'LP, 33 1/3 rpm', pressing: '1989 UK original',
    description: 'The Cure\'s magnum opus. Eight minutes of "Plainsong" alone justify owning this on vinyl. Dense, atmospheric, and relentlessly beautiful.',
    reason: 'Recommended because it has similar tags and is in stock.',
  },
  {
    id: 11, title: 'The Velvet Underground & Nico', artist: 'The Velvet Underground', genre: 'Rock',
    year: 1967, price: 88, stock: 'in', condition: 'VG',
    label: 'Verve Records', format: 'LP, 33 1/3 rpm', pressing: '1967 US original',
    description: 'Perhaps the most influential rock album ever made. Few people bought it on release, but those who did started bands. The banana cover alone is iconic.',
    reason: 'Recommended because it shares similar tags.',
  },
  {
    id: 12, title: 'Rumours', artist: 'Fleetwood Mac', genre: 'Rock',
    year: 1977, price: 34, stock: 'in', condition: 'VG+',
    label: 'Warner Bros.', format: 'LP, 33 1/3 rpm', pressing: '1977 US original',
    description: 'Recorded amid the collapse of multiple relationships within the band, Rumours channels personal turmoil into eleven perfect songs. One of the best-mastered albums in rock history.',
    reason: 'Recommended because it has similar tags and is in stock.',
  },
  {
    id: 21, title: 'OK Computer', artist: 'Radiohead', genre: 'Rock',
    year: 1997, price: 45, stock: 'in', condition: 'NM',
    label: 'Parlophone', format: 'LP, 33 1/3 rpm', pressing: '1997 UK original',
    description: 'A prophetic record about alienation in the digital age, marrying guitar rock with electronic textures and orchestral arrangements years ahead of its time.',
    reason: 'Recommended because it shares similar tags to records you\'ve viewed.',
  },
  {
    id: 22, title: 'Tapestry', artist: 'Carole King', genre: 'Rock',
    year: 1971, price: 28, stock: 'in', condition: 'VG+',
    label: 'Ode Records', format: 'LP, 33 1/3 rpm', pressing: '1971 US original',
    description: 'A defining singer-songwriter record of the 1970s, full of warm piano, plainspoken lyrics, and songs that became standards almost overnight.',
    reason: 'Recommended because it shares the same era as your recent views.',
  },
  {
    id: 23, title: 'Led Zeppelin IV', artist: 'Led Zeppelin', genre: 'Rock',
    year: 1971, price: 52, stock: 'low', condition: 'VG',
    label: 'Atlantic Records', format: 'LP, 33 1/3 rpm', pressing: '1971 UK original',
    description: 'Untitled and symbol-laden, this is the record that gave the world "Stairway to Heaven" and cemented Zeppelin\'s fusion of blues, folk, and hard rock.',
    reason: 'Recommended because it has similar tags and is in stock.',
  },
  {
    id: 24, title: 'Currents', artist: 'Tame Impala', genre: 'Rock',
    year: 2015, price: 38, stock: 'in', condition: 'M',
    label: 'Modular Recordings', format: '2xLP', pressing: '2015 Australian original',
    description: 'Kevin Parker\'s pivot from psych-rock to synth-driven pop, exploring heartbreak and transformation through dense, kaleidoscopic production.',
    reason: 'Recommended because it shares similar tags to your wishlist.',
  },

  // ── Electronic ────────────────────────────────────────
  {
    id: 4, title: 'Homework', artist: 'Daft Punk', genre: 'Electronic',
    year: 1997, price: 44, stock: 'out', condition: 'VG+',
    label: 'Virgin Records', format: 'LP, 33 1/3 rpm', pressing: '1997 EU original',
    description: 'The debut album that launched French house into the mainstream. Homework blends Chicago house, funk, and techno into an irresistibly danceable package.',
    reason: 'Recommended because you rated an electronic album 5 stars.',
  },
  {
    id: 10, title: 'Dummy', artist: 'Portishead', genre: 'Electronic',
    year: 1994, price: 36, stock: 'in', condition: 'NM',
    label: 'Go! Discs', format: 'LP, 33 1/3 rpm', pressing: '1994 UK original',
    description: "The debut that defined trip-hop. Portishead's blend of hip-hop beats, cinematic samples, and Beth Gibbons's haunting vocals created a genre-defining record.",
    reason: 'Recommended because you rated an electronic album 5 stars.',
  },
  {
    id: 25, title: 'Discovery', artist: 'Daft Punk', genre: 'Electronic',
    year: 2001, price: 42, stock: 'in', condition: 'NM',
    label: 'Virgin Records', format: 'LP, 33 1/3 rpm', pressing: '2001 EU original',
    description: 'A euphoric, disco-soaked follow-up to Homework, built almost entirely from sampled vinyl. The record that gave us "One More Time."',
    reason: 'Recommended because you bought another record by this artist.',
  },
  {
    id: 26, title: 'Selected Ambient Works 85–92', artist: 'Aphex Twin', genre: 'Electronic',
    year: 1992, price: 56, stock: 'low', condition: 'VG+',
    label: 'Apollo Records', format: '2xLP', pressing: '1992 UK original',
    description: 'Hypnotic, melancholic, and quietly strange — this collection of bedroom productions became the foundational text of ambient techno.',
    reason: 'Recommended because you rated an electronic album 5 stars.',
  },
  {
    id: 27, title: 'Reflection', artist: 'Brian Eno', genre: 'Electronic',
    year: 2017, price: 39, stock: 'in', condition: 'M',
    label: 'Warp Records', format: 'LP, 33 1/3 rpm', pressing: '2017 UK original',
    description: 'A single continuous piece of generative ambient music, designed to evolve endlessly. Eno at his most meditative and patient.',
    reason: 'Recommended because it has similar tags and is in stock.',
  },
  {
    id: 28, title: 'Music Has the Right to Children', artist: 'Boards of Canada', genre: 'Electronic',
    year: 1998, price: 60, stock: 'in', condition: 'NM',
    label: 'Warp Records', format: 'LP, 33 1/3 rpm', pressing: '1998 UK original',
    description: 'Warped nostalgia rendered in hazy synths and decayed samples, evoking half-remembered childhood educational films. Endlessly influential and deeply strange.',
    reason: 'Recommended because it shares similar tags to your wishlist.',
  },

  // ── Folk ──────────────────────────────────────────────
  {
    id: 3, title: 'Blue', artist: 'Joni Mitchell', genre: 'Folk',
    year: 1971, price: 55, stock: 'low', condition: 'NM',
    label: 'Reprise Records', format: 'LP, 33 1/3 rpm', pressing: '1971 US original',
    description: 'Widely considered one of the greatest albums ever made. Mitchell\'s confessional songwriting and unconventional guitar tunings set a new standard for folk and singer-songwriter music.',
    reason: 'Recommended because it shares the same era as your recent views.',
  },
  {
    id: 29, title: 'Pink Moon', artist: 'Nick Drake', genre: 'Folk',
    year: 1972, price: 64, stock: 'in', condition: 'VG+',
    label: 'Island Records', format: 'LP, 33 1/3 rpm', pressing: '1972 UK original',
    description: 'Recorded in just two late-night sessions with only voice and guitar, this is one of the most spare and haunting folk records ever committed to tape.',
    reason: 'Recommended because it shares the same era as your recent views.',
  },
  {
    id: 30, title: 'Harvest', artist: 'Neil Young', genre: 'Folk',
    year: 1972, price: 36, stock: 'in', condition: 'VG+',
    label: 'Reprise Records', format: 'LP, 33 1/3 rpm', pressing: '1972 US original',
    description: 'Young\'s best-selling album, blending country twang with orchestral folk balladry. "Heart of Gold" made it a crossover hit.',
    reason: 'Recommended because it shares the same era and genre as records you own.',
  },
  {
    id: 31, title: 'The Freewheelin\' Bob Dylan', artist: 'Bob Dylan', genre: 'Folk',
    year: 1963, price: 48, stock: 'low', condition: 'VG',
    label: 'Columbia Records', format: 'LP, 33 1/3 rpm', pressing: '1963 US original',
    description: 'The record that turned Dylan into the voice of a generation, packed with protest songs and love songs that rewrote what folk music could say.',
    reason: 'Recommended because it shares similar tags to your wishlist.',
  },
  {
    id: 32, title: 'For Emma, Forever Ago', artist: 'Bon Iver', genre: 'Folk',
    year: 2007, price: 34, stock: 'in', condition: 'NM',
    label: 'Jagjaguwar', format: 'LP, 33 1/3 rpm', pressing: '2007 US original',
    description: 'Recorded alone in a Wisconsin cabin during a hard winter, this whispery, reverb-soaked debut redefined what indie folk could sound like.',
    reason: 'Recommended because it has similar tags and is in stock.',
  },

  // ── Hip-Hop ───────────────────────────────────────────
  {
    id: 33, title: 'Illmatic', artist: 'Nas', genre: 'Hip-Hop',
    year: 1994, price: 46, stock: 'in', condition: 'NM',
    label: 'Columbia Records', format: 'LP, 33 1/3 rpm', pressing: '1994 US original',
    description: 'A dense, cinematic portrait of Queensbridge life, widely regarded as one of the greatest hip-hop albums ever recorded. Ten tracks, zero filler.',
    reason: 'Recommended because it shares similar tags to your wishlist.',
  },
  {
    id: 34, title: 'The Low End Theory', artist: 'A Tribe Called Quest', genre: 'Hip-Hop',
    year: 1991, price: 44, stock: 'in', condition: 'VG+',
    label: 'Jive Records', format: 'LP, 33 1/3 rpm', pressing: '1991 US original',
    description: 'A jazz-rap landmark built on upright bass samples and laid-back flows, bridging the gap between bebop and golden-age hip-hop.',
    reason: 'Recommended because it shares the same era and genre as records you own.',
  },
  {
    id: 35, title: 'Madvillainy', artist: 'Madvillain', genre: 'Hip-Hop',
    year: 2004, price: 50, stock: 'low', condition: 'NM',
    label: 'Stones Throw Records', format: 'LP, 33 1/3 rpm', pressing: '2004 US original',
    description: 'A cult-classic collaboration between MF DOOM and Madlib — dusty loops, cryptic rhymes, and tracks that rarely break the two-minute mark.',
    reason: 'Recommended because it has similar tags and is in stock.',
  },
  {
    id: 36, title: 'To Pimp a Butterfly', artist: 'Kendrick Lamar', genre: 'Hip-Hop',
    year: 2015, price: 40, stock: 'in', condition: 'M',
    label: 'Top Dawg Entertainment', format: '2xLP', pressing: '2015 US original',
    description: 'A sprawling, jazz-infused concept album wrestling with fame, race, and self-worth. Among the most acclaimed hip-hop records of the decade.',
    reason: 'Recommended because it shares similar tags to your wishlist.',
  },

  // ── Blues ─────────────────────────────────────────────
  {
    id: 37, title: 'King of the Delta Blues Singers', artist: 'Robert Johnson', genre: 'Blues',
    year: 1961, price: 58, stock: 'in', condition: 'VG',
    label: 'Columbia Records', format: 'LP, 33 1/3 rpm', pressing: '1961 US original',
    description: 'A posthumous compilation of recordings made in 1936–37 that became the foundational text of the blues, inspiring nearly every rock guitarist who followed.',
    reason: 'Recommended because it shares the same genre and release era.',
  },
  {
    id: 38, title: 'Live at the Regal', artist: 'B.B. King', genre: 'Blues',
    year: 1965, price: 36, stock: 'in', condition: 'VG+',
    label: 'ABC Records', format: 'LP, 33 1/3 rpm', pressing: '1965 US original',
    description: 'Widely considered the greatest live blues album ever recorded, capturing King\'s guitar work and stage presence at an electrifying peak.',
    reason: 'Recommended because it has similar tags and is in stock.',
  },
  {
    id: 39, title: 'Texas Flood', artist: 'Stevie Ray Vaughan', genre: 'Blues',
    year: 1983, price: 32, stock: 'low', condition: 'NM',
    label: 'Epic Records', format: 'LP, 33 1/3 rpm', pressing: '1983 US original',
    description: 'A ferocious debut that single-handedly revived blues-rock guitar in the 1980s, recorded live in the studio in just two days.',
    reason: 'Recommended because it shares similar tags to your wishlist.',
  },

  // ── Classical ─────────────────────────────────────────
  {
    id: 40, title: 'Glenn Gould Plays Bach: Goldberg Variations', artist: 'Glenn Gould', genre: 'Classical',
    year: 1955, price: 42, stock: 'in', condition: 'VG+',
    label: 'Columbia Masterworks', format: 'LP, 33 1/3 rpm', pressing: '1955 US original',
    description: 'Gould\'s electrifying debut recording, played at a tempo that scandalized critics and reinvented how Bach\'s keyboard works could be heard.',
    reason: 'Recommended because it shares the same era as your recent views.',
  },
  {
    id: 41, title: 'The Four Seasons', artist: 'Antonio Vivaldi (I Musici)', genre: 'Classical',
    year: 1959, price: 28, stock: 'in', condition: 'VG',
    label: 'Philips Records', format: 'LP, 33 1/3 rpm', pressing: '1959 EU original',
    description: 'One of the most beloved recordings of Vivaldi\'s violin concertos, prized for its warmth and the clarity of I Musici\'s chamber playing.',
    reason: 'Recommended because it has similar tags and is in stock.',
  },
  {
    id: 42, title: 'Symphony No. 9 "Choral"', artist: 'Beethoven (Berlin Philharmonic, Karajan)', genre: 'Classical',
    year: 1963, price: 38, stock: 'low', condition: 'VG+',
    label: 'Deutsche Grammophon', format: '2xLP', pressing: '1963 German original',
    description: 'Karajan\'s first complete Beethoven cycle with the Berlin Philharmonic, capped by a thunderous, definitive reading of the Ninth.',
    reason: 'Recommended because it shares the same era as your recent views.',
  },
];

export const GENRES     = ['Jazz', 'Rock', 'Soul', 'Electronic', 'Classical', 'Folk', 'Hip-Hop', 'Blues'];
export const ERAS       = ['1950s', '1960s', '1970s', '1980s', '1990s', '2000s+'];
export const CONDITIONS = ['M', 'NM', 'VG+', 'VG', 'G'];
