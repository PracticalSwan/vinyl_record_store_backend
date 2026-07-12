import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { records } from "../src/data/records.js";
import { comparisonKey } from "../src/lib/catalog/normalize.js";
import { createJsonFileCache } from "../src/lib/external/jsonFileCache.js";

const API_ROOT = "https://musicbrainz.org/ws/2/release";
const REQUEST_INTERVAL_MS = 1_100;
const REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_USER_AGENT = "GroovehausVinyl/0.1 (https://github.com/PracticalSwan/vinyl_record_store_backend)";
const cache = createJsonFileCache({ directory: path.resolve(".cache", "artwork-curation") });
let nextRequestAt = 0;

const REVIEW_IDENTITIES = new Map([
  [40, { title: "The Goldberg Variations", artist: "Glenn Gould" }],
  [41, { title: "The Four Seasons", artist: "I Musici" }],
  [42, { title: "9 Symphonien", artist: "Herbert von Karajan" }],
  [126, { title: "The Planets", artist: "London Philharmonic Orchestra, Bernard Haitink" }],
  [127, { title: "Rhapsody in Blue / An American in Paris", artist: "Leonard Bernstein" }],
  [128, { title: "The Well-Tempered Clavier, Book I", artist: "Wanda Landowska" }],
  [202, { title: "A Night at the Village Vanguard", artist: "Sonny Rollins" }],
  [219, { title: "The Rise and Fall of Ziggy Stardust and the Spiders From Mars", artist: "David Bowie" }],
  [240, { title: "Blues Breakers With Eric Clapton", artist: "John Mayall & the Bluesbreakers" }],
  [241, { title: "The Six Cello Suites", artist: "Pablo Casals" }],
  [242, { title: "Die Klaviersonaten", artist: "Wilhelm Kempff" }],
  [243, { title: "Death and the Maiden", artist: "Alban Berg Quartet" }],
  [244, { title: "Symphonie Nr. 5", artist: "Carlos Kleiber" }],
]);

const REVIEW_RELEASE_IDS = new Map([
  [17, "529eb6b3-87e0-4897-a27a-ce858af7745b"],
  [34, "cf45c6f5-b53f-4424-8caf-9ff792796cf2"],
  [40, "2a7844fb-13b9-437a-8f68-c018c53f5f72"],
  [41, "748b1e5d-0a2d-487b-ac25-88b5e2b5b749"],
  [42, "d96c782c-9b3e-4ef0-a792-0680a27e630e"],
  [126, "83ddebed-a570-4437-9bc3-9eb8f286c742"],
  [127, "ce84c952-f878-3ac1-b065-3ff6ae012301"],
  [128, "7036da8e-eacd-4ae5-87b3-d1ff2f37012b"],
  [202, "26705916-eb85-4823-b061-2b6afd59b577"],
  [203, "b080958a-f13b-4be3-b02d-7537f9a14735"],
  [207, "3f83df01-bdca-461c-b655-9252d255d0fd"],
  [210, "bbeded36-8d04-4b3b-8b8b-6fa2e4fec570"],
  [219, "7dc5edce-ead6-41e4-9c4b-240223c9bab0"],
  [240, "d6cc798f-d0a4-3f87-8137-3a8341592635"],
  [241, "88048480-0ac0-42f8-97a5-011bb4d9c8de"],
  [242, "c05092fa-e75c-486f-be18-6d9c3f0595ca"],
  [243, "786f03cd-3bbb-4d2c-87ec-afc4c436e653"],
  [244, "bb934503-6cd8-4942-8144-aa9609795c40"],
]);

function parseArguments(argv) {
  const options = { ids: null, output: null, html: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--ids") {
      options.ids = String(argv[++index] || "")
        .split(",")
        .filter(Boolean)
        .map((value) => Number.parseInt(value, 10));
    } else if (argument.startsWith("--ids=")) {
      options.ids = argument.slice("--ids=".length)
        .split(",")
        .filter(Boolean)
        .map((value) => Number.parseInt(value, 10));
    } else if (argument === "--output") {
      options.output = argv[++index] || null;
    } else if (argument.startsWith("--output=")) {
      options.output = argument.slice("--output=".length);
    } else if (argument === "--html") {
      options.html = argv[++index] || null;
    } else if (argument.startsWith("--html=")) {
      options.html = argument.slice("--html=".length);
    } else {
      throw new Error(`Unsupported argument: ${argument}`);
    }
  }
  if (options.ids?.some((id) => !Number.isInteger(id))) {
    throw new Error("--ids must be a comma-separated list of integers.");
  }
  return options;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderHtml(report) {
  const cards = report.proposals.map((proposal) => {
    const selected = proposal.selected;
    const artwork = selected?.artwork;
    return `<article class="card" data-quality="${escapeHtml(proposal.quality)}">
      <img src="${escapeHtml(artwork?.thumbnailUrl)}" alt="${escapeHtml(`${proposal.record.title} by ${proposal.record.artist}`)}">
      <div class="body">
        <p class="id">Catalog ${proposal.publicId} · ${escapeHtml(proposal.quality)}</p>
        <h2>${escapeHtml(proposal.record.title)}</h2>
        <p>${escapeHtml(proposal.record.artist)}</p>
        <dl>
          <dt>Reviewed release</dt><dd>${escapeHtml(selected?.title)} · ${escapeHtml(selected?.artist)}</dd>
          <dt>Edition</dt><dd>${escapeHtml(selected?.date || "undated")} · ${escapeHtml(selected?.country || "country unknown")} · ${escapeHtml((selected?.formats || []).join(" + "))}</dd>
          <dt>Artwork binding</dt><dd>${escapeHtml(artwork?.entity)} ${escapeHtml(artwork?.entityId)}</dd>
        </dl>
        <a href="https://musicbrainz.org/release/${escapeHtml(selected?.id)}">Open MusicBrainz release</a>
      </div>
    </article>`;
  }).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Groovehaus artwork curation review</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; background: #f7f4ef; color: #241d1a; font-family: Arial, sans-serif; }
    header { max-width: 1100px; margin: 0 auto 24px; }
    h1 { margin: 0 0 8px; font: 700 32px Georgia, serif; }
    .summary { color: #6d5f58; }
    main { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 18px; max-width: 1600px; margin: 0 auto; }
    .card { overflow: hidden; border: 1px solid #d8cec6; border-radius: 12px; background: white; box-shadow: 0 3px 12px rgba(36, 29, 26, .08); }
    .card img { display: block; width: 100%; aspect-ratio: 1; object-fit: contain; background: #30221f; }
    .body { padding: 14px; }
    .id { margin: 0 0 8px; color: #8b3f29; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
    h2 { margin: 0 0 4px; font: 700 18px Georgia, serif; }
    p { margin: 0 0 10px; }
    dl { display: grid; gap: 4px; margin: 12px 0; font-size: 12px; }
    dt { color: #6d5f58; font-weight: 700; }
    dd { margin: 0 0 5px; overflow-wrap: anywhere; }
    a { color: #8b3f29; }
  </style>
</head>
<body>
  <header>
    <h1>Groovehaus artwork curation review</h1>
    <p class="summary">${report.rows} catalog rows · ${report.counts.exact} exact · ${report.counts.close} close · ${report.counts.manualReview} manually pinned · ${report.counts.withArtwork} with approved artwork</p>
  </header>
  <main>${cards}</main>
</body>
</html>\n`;
}

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function requestMusicBrainz(query) {
  const url = new URL(API_ROOT);
  url.searchParams.set("query", query);
  url.searchParams.set("limit", "100");
  url.searchParams.set("fmt", "json");
  const cacheKey = `musicbrainz-review:${url}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const wait = Math.max(0, nextRequestAt - Date.now());
  if (wait) await pause(wait);
  nextRequestAt = Date.now() + REQUEST_INTERVAL_MS;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": process.env.MUSICBRAINZ_USER_AGENT || DEFAULT_USER_AGENT,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`MusicBrainz returned HTTP ${response.status}.`);
  const payload = await response.json();
  await cache.set(cacheKey, payload);
  return payload;
}

async function requestMusicBrainzRelease(releaseId) {
  const url = new URL(`https://musicbrainz.org/ws/2/release/${releaseId}`);
  url.searchParams.set("inc", "artist-credits+release-groups+labels+media");
  url.searchParams.set("fmt", "json");
  const cacheKey = `musicbrainz-review:${url}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const wait = Math.max(0, nextRequestAt - Date.now());
  if (wait) await pause(wait);
  nextRequestAt = Date.now() + REQUEST_INTERVAL_MS;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": process.env.MUSICBRAINZ_USER_AGENT || DEFAULT_USER_AGENT,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`MusicBrainz returned HTTP ${response.status}.`);
  const payload = await response.json();
  await cache.set(cacheKey, payload);
  return payload;
}

function desiredCountry(pressing = "") {
  const value = String(pressing).toLowerCase();
  if (/\bus\b/.test(value)) return "US";
  if (/\buk\b/.test(value)) return "GB";
  if (value.includes("australian")) return "AU";
  if (value.includes("canadian")) return "CA";
  if (value.includes("french")) return "FR";
  if (value.includes("german")) return "DE";
  if (/\beu\b/.test(value)) return "XE";
  return null;
}

function desiredYear(record) {
  const match = String(record.pressing || "").match(/\b(19|20)\d{2}\b/);
  return match ? Number.parseInt(match[0], 10) : record.year;
}

function desiredDiscCount(format = "") {
  const match = String(format).match(/^(\d+)xLP/i);
  return match ? Number.parseInt(match[1], 10) : 1;
}

function artistPhrase(release) {
  return (release["artist-credit"] || [])
    .map((credit) => `${credit.name || ""}${credit.joinphrase || ""}`)
    .join("")
    .trim();
}

function artistSearchValue(record) {
  return String(record.artist)
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\s+and\s+/gi, " & ")
    .trim();
}

function reviewKey(value) {
  return comparisonKey(value)
    .replace(/[’‘`]/g, "'")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function similarArtist(left, right) {
  const leftKey = reviewKey(left).replace(/\band\b/g, "");
  const rightKey = reviewKey(right).replace(/\band\b/g, "");
  if (leftKey === rightKey) return true;
  const leftTokens = new Set(leftKey.split(" ").filter((token) => token.length > 1));
  const rightTokens = new Set(rightKey.split(" ").filter((token) => token.length > 1));
  if (!leftTokens.size || !rightTokens.size) return false;
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return overlap / Math.min(leftTokens.size, rightTokens.size) >= 0.75;
}

function labelMatches(record, release) {
  const expected = comparisonKey(record.label).replace(/\brecords?\b/g, "").trim();
  return (release["label-info"] || []).some((item) => {
    const actual = comparisonKey(item.label?.name).replace(/\brecords?\b/g, "").trim();
    return actual && (actual === expected || actual.includes(expected) || expected.includes(actual));
  });
}

function summarizeCandidate(record, release) {
  const media = Array.isArray(release.media) ? release.media : [];
  const formats = media.map((item) => item.format).filter(Boolean);
  const primaryType = release["release-group"]?.["primary-type"] || null;
  const candidateYear = Number.parseInt(String(release.date || "").slice(0, 4), 10) || null;
  const titleExact = reviewKey(release.title) === reviewKey(record.title);
  const artist = artistPhrase(release);
  const artistExact = similarArtist(artist, artistSearchValue(record));
  const vinyl = formats.some((format) => /vinyl/i.test(format));
  const albumVinyl = vinyl
    && formats.every((format) => /^(?:12\" )?vinyl$/i.test(format))
    && primaryType === "Album";
  const country = release.country || null;
  const countryExact = !desiredCountry(record.pressing) || country === desiredCountry(record.pressing);
  const pressingYearExact = candidateYear === desiredYear(record);
  const albumYearExact = candidateYear === record.year;
  const discs = media.length || null;
  const discsExact = discs === desiredDiscCount(record.format);
  const matchingLabel = labelMatches(record, release);
  const official = release.status === "Official";
  const releaseGroupId = release["release-group"]?.id || null;

  let score = Number(release.score || 0) / 10;
  score += titleExact ? 60 : -60;
  score += artistExact ? 50 : -35;
  score += albumVinyl ? 75 : (vinyl ? -120 : -220);
  score += primaryType === "Album" ? 35 : -100;
  score += pressingYearExact ? 28 : (albumYearExact ? 16 : -Math.min(20, Math.abs((candidateYear || 0) - desiredYear(record))));
  score += countryExact ? 20 : -5;
  score += matchingLabel ? 15 : 0;
  score += discsExact ? 10 : 0;
  score += official ? 8 : -8;

  return {
    id: release.id,
    releaseGroupId,
    title: release.title || null,
    artist,
    date: release.date || null,
    country,
    status: release.status || null,
    primaryType,
    formats,
    discCount: discs,
    labels: (release["label-info"] || []).map((item) => ({
      name: item.label?.name || null,
      catalogNumber: item["catalog-number"] || null,
    })),
    match: {
      titleExact,
      artistExact,
      vinyl,
      albumVinyl,
      pressingYearExact,
      albumYearExact,
      countryExact,
      labelExact: matchingLabel,
      discCountExact: discsExact,
      official,
    },
    score,
  };
}

async function findCandidates(record) {
  const reviewIdentity = REVIEW_IDENTITIES.get(record.id) || {
    title: record.title,
    artist: artistSearchValue(record),
  };
  const reviewRecord = { ...record, ...reviewIdentity };
  const title = JSON.stringify(reviewRecord.title);
  const artist = JSON.stringify(reviewRecord.artist);
  const primary = await requestMusicBrainz(`release:${title} AND artist:${artist}`);
  let releases = primary.releases || [];
  if (!releases.some((release) => reviewKey(release.title) === reviewKey(reviewRecord.title))) {
    const fallback = await requestMusicBrainz(`release:${title}`);
    releases = [...releases, ...(fallback.releases || [])];
  }
  const unique = new Map(releases.map((release) => [release.id, release]));
  const pinnedReleaseId = REVIEW_RELEASE_IDS.get(record.id);
  if (pinnedReleaseId) {
    unique.delete(pinnedReleaseId);
    const pinned = await requestMusicBrainzRelease(pinnedReleaseId);
    unique.set(pinnedReleaseId, pinned);
  }
  const ranked = [...unique.values()]
    .map((release) => summarizeCandidate(reviewRecord, release))
    .sort((left, right) => right.score - left.score);
  if (!pinnedReleaseId) return ranked.slice(0, 12);
  const pinned = ranked.find((candidate) => candidate.id === pinnedReleaseId);
  return pinned
    ? [pinned, ...ranked.filter((candidate) => candidate.id !== pinnedReleaseId).slice(0, 11)]
    : ranked.slice(0, 12);
}

async function findArtwork(entity, entityId) {
  const url = `https://coverartarchive.org/${entity}/${entityId}`;
  const cacheKey = `cover-art-review:${url}`;
  const cached = await cache.get(cacheKey);
  let payload = cached;
  if (!payload) {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": process.env.MUSICBRAINZ_USER_AGENT || DEFAULT_USER_AGENT,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Cover Art Archive returned HTTP ${response.status}.`);
    payload = await response.json();
    await cache.set(cacheKey, payload);
  }
  const front = (payload.images || []).find((image) => image.approved && image.front);
  if (!front) return null;
  const toHttps = (value) => {
    if (!value) return null;
    const url = new URL(value);
    url.protocol = "https:";
    return url.toString();
  };
  const thumbnailUrl = toHttps(front.thumbnails?.["500"] || front.thumbnails?.large);
  const detailUrl = toHttps(front.thumbnails?.["1200"] || front.image || thumbnailUrl);
  return thumbnailUrl && detailUrl ? {
    thumbnailUrl,
    detailUrl,
    entity,
    entityId,
  } : null;
}

async function propose(record) {
  const candidates = await findCandidates(record);
  const reviewed = candidates.slice(0, 4).map((candidate) => ({ ...candidate, artwork: null }));
  const selected = reviewed[0] || null;
  if (selected) {
    try {
      selected.artwork = await findArtwork("release", selected.id);
      if (!selected.artwork && selected.releaseGroupId) {
        selected.artwork = await findArtwork("release-group", selected.releaseGroupId);
      }
    } catch (error) {
      selected.artworkError = error.message;
    }
  }
  const quality = selected?.match.titleExact
    && selected.match.artistExact
    && selected.match.albumVinyl
    && selected.match.official
    && selected.match.pressingYearExact
    && selected.match.countryExact
    ? "exact"
    : selected?.match.titleExact && selected.match.artistExact && selected.match.albumVinyl
      ? "close"
      : "manual-review";
  return {
    publicId: record.id,
    record: {
      title: record.title,
      artist: record.artist,
      albumYear: record.year,
      pressing: record.pressing,
      label: record.label,
      format: record.format,
    },
    desired: {
      pressingYear: desiredYear(record),
      country: desiredCountry(record.pressing),
      discCount: desiredDiscCount(record.format),
    },
    quality,
    selected,
    alternatives: reviewed.filter((candidate) => candidate.id !== selected?.id).slice(0, 3),
  };
}

const options = parseArguments(process.argv.slice(2));
const selectedRecords = options.ids
  ? records.filter((record) => options.ids.includes(record.id))
  : records;
if (options.ids && selectedRecords.length !== new Set(options.ids).size) {
  throw new Error("One or more requested public IDs do not exist in the catalog.");
}

const proposals = [];
for (const [index, record] of selectedRecords.entries()) {
  process.stderr.write(`[${index + 1}/${selectedRecords.length}] ${record.id}: ${record.artist} - ${record.title}\n`);
  proposals.push(await propose(record));
}

const report = {
  generatedAt: new Date().toISOString(),
  source: "MusicBrainz release search plus Cover Art Archive front-art lookup",
  grain: "one proposal per catalog publicId",
  rows: proposals.length,
  counts: {
    exact: proposals.filter((item) => item.quality === "exact").length,
    close: proposals.filter((item) => item.quality === "close").length,
    manualReview: proposals.filter((item) => item.quality === "manual-review").length,
    withArtwork: proposals.filter((item) => item.selected?.artwork).length,
  },
  proposals,
};

if (options.output) {
  const destination = path.resolve(options.output);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ output: destination, ...report.counts, rows: report.rows }, null, 2));
} else {
  console.log(JSON.stringify(report, null, 2));
}

if (options.html) {
  const destination = path.resolve(options.html);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, renderHtml(report), "utf8");
  console.log(JSON.stringify({ html: destination, rows: report.rows }, null, 2));
}
