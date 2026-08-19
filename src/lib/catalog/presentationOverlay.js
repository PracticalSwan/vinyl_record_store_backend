import overlay from "../../data/catalogPresentationOverlay.json" with { type: "json" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_ID_PATTERN = /^[1-9][0-9]{0,9}$/;
const hiddenPublicIds = Object.freeze([...overlay.hiddenPublicIds]);
const hiddenPublicIdSet = new Set(hiddenPublicIds.map(String));

if (
  overlay.schemaVersion !== 1
  || typeof overlay.datasetKey !== "string"
  || hiddenPublicIdSet.size !== hiddenPublicIds.length
  || hiddenPublicIds.some((value) => !PUBLIC_ID_PATTERN.test(String(value)))
) {
  throw new Error("The catalog presentation overlay is invalid.");
}

const supplementalArtwork = new Map(Object.entries(overlay.supplementalArtwork || {}));
for (const [publicId, entry] of supplementalArtwork) {
  if (
    !PUBLIC_ID_PATTERN.test(publicId)
    || !UUID_PATTERN.test(String(entry?.releaseGroupId || ""))
    || !Number.isFinite(Number(entry?.matchScore))
    || Number(entry.matchScore) < 95
  ) {
    throw new Error("The catalog presentation artwork overlay is invalid.");
  }
}

export function hiddenPublicIdsForDataset(datasetKey) {
  return datasetKey === overlay.datasetKey ? hiddenPublicIds : [];
}

export function presentationVisibilityFilter(datasetKey) {
  const hidden = hiddenPublicIdsForDataset(datasetKey);
  return hidden.length ? { publicId: { $nin: hidden } } : {};
}

export function supplementalArtworkForProduct(publicId, datasetKey) {
  if (datasetKey !== overlay.datasetKey) return null;
  const entry = supplementalArtwork.get(String(publicId));
  if (!entry) return null;
  const groupId = entry.releaseGroupId;
  return {
    thumbnailUrl: `https://coverartarchive.org/release-group/${groupId}/front-500`,
    detailUrl: `https://coverartarchive.org/release-group/${groupId}/front-1200`,
    source: "cover-art-archive",
    sourceUrl: `https://musicbrainz.org/release-group/${groupId}`,
  };
}

const singlePrefixTail = new Set(["and", "&", "with", "group", "trio", "brotherhood", "band", "friends", "vanguard", "mothers"]);

export function cleanPresentationTitle(value) {
  if (typeof value !== "string") return value;
  return value
    .replace(/\s+Explicit Lyrics\b/gi, "")
    .replace(/\s*\[LP\]\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanPresentationArtist(value) {
  if (typeof value !== "string") return value;
  const words = value.trim().split(/\s+/);
  const maxPrefix = Math.min(6, Math.floor((words.length - 1) / 2));
  for (let size = maxPrefix; size >= 1; size -= 1) {
    const first = words.slice(0, size).join(" ").toLocaleLowerCase("en");
    const second = words.slice(size, size * 2).join(" ").toLocaleLowerCase("en");
    const tail = words.slice(size * 2);
    if (first !== second || !tail.length) continue;
    if (size === 1 && !singlePrefixTail.has(String(tail[0]).toLocaleLowerCase("en"))) continue;
    return words.slice(size).join(" ");
  }
  return value;
}
