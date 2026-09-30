/** The host without a leading "www.", lower-cased, so example.com and www.example.com match. */
function withoutWww(host: string): string {
  return host.toLowerCase().replace(/^www\./, '');
}

/**
 * True when two hosts are one site: identical, or one is the other's www twin (example.com and
 * www.example.com). Ports must match, and any other subdomain (app.example.com) is another site.
 */
export function isSameSite(host: string, siteHost: string): boolean {
  return withoutWww(host) === withoutWww(siteHost);
}
