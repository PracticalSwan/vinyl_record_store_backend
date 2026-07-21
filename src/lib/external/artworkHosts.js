const COVER_ART_ARCHIVE_HOSTS = new Set([
  "coverartarchive.org",
  "www.coverartarchive.org",
]);

function normalizedHostname(value) {
  return String(value || "").trim().toLowerCase().replace(/\.$/, "");
}
export function isCoverArtArchiveHost(hostname) {
  return COVER_ART_ARCHIVE_HOSTS.has(normalizedHostname(hostname));
}

export function isTrustedArtworkRedirectHost(hostname) {
  const host = normalizedHostname(hostname);
  return isCoverArtArchiveHost(host) || host === "archive.org" || host.endsWith(".archive.org");
}
