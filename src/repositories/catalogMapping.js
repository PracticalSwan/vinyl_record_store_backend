const valueOf = (record) => (
  typeof record?.toObject === "function" ? record.toObject() : record
);

const approvedUrl = (value, hosts) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && hosts.includes(url.hostname.toLowerCase())
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

export function toPublicProduct(record) {
  const value = valueOf(record);
  if (!value) return null;

  const legacyUrl = value.imageUrl ?? value.artwork?.url ?? null;
  const thumbnailUrl = approvedUrl(
    value.artwork?.thumbnailUrl,
    ["coverartarchive.org", "www.coverartarchive.org"],
  );
  const detailUrl = approvedUrl(
    value.artwork?.detailUrl,
    ["coverartarchive.org", "www.coverartarchive.org"],
  );
  const sourceUrl = approvedUrl(
    value.artwork?.sourceUrl,
    ["musicbrainz.org", "www.musicbrainz.org"],
  );
  const hasStructuredImage = Boolean(
    thumbnailUrl
    && detailUrl
    && value.artwork?.source === "cover-art-archive"
    && sourceUrl,
  );

  return {
    id: value.publicId ?? value.id,
    title: value.title,
    artist: value.artist,
    genre: value.genre,
    year: value.year,
    price: value.price,
    stock: value.stock,
    condition: value.condition,
    label: value.label,
    format: value.format,
    pressing: value.pressing,
    description: value.description,
    currency: value.currency || "USD",
    imageUrl: legacyUrl,
    image: hasStructuredImage ? {
      thumbnailUrl,
      detailUrl,
      source: value.artwork.source,
      sourceUrl,
    } : null,
  };
}

export function slugifyProduct(record) {
  const base = `${record.artist}-${record.title}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 280)
    .replace(/-+$/g, "");
  return `${base || "record"}-${record.id}`;
}

export function toPersistenceProduct(record) {
  const product = toPublicProduct(record);
  return {
    publicId: product.id,
    slug: slugifyProduct(record),
    title: product.title,
    artist: product.artist,
    genre: product.genre,
    year: product.year,
    price: product.price,
    currency: product.currency,
    stock: product.stock,
    condition: product.condition,
    label: product.label,
    format: product.format,
    pressing: product.pressing,
    description: product.description,
    imageUrl: product.imageUrl,
    musicBrainzReleaseId: record.musicBrainzReleaseId ?? null,
    musicBrainzReleaseGroupId: record.musicBrainzReleaseGroupId ?? null,
    artwork: record.artwork ? { ...record.artwork } : {},
    source: "demo-seed",
    provenance: Array.isArray(record.provenance) ? record.provenance : [],
    deletedAt: null,
  };
}
