const valueOf = (record) => (
  typeof record?.toObject === "function" ? record.toObject() : record
);

export function toPublicProduct(record) {
  const value = valueOf(record);
  if (!value) return null;

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
    imageUrl: value.imageUrl ?? value.artwork?.url ?? null,
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
    source: "demo-seed",
    deletedAt: null,
  };
}
