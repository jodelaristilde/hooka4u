// src/lib/site.ts
//
// This app serves two domains (vipservice4u.us and jaeky.us) from the same
// codebase and the same database, partitioned entirely by data: every
// MenuCategory, MenuItems, MenuItemTemplate and Order record carries a
// `site` field. Which domain a request came in on (via the `Host` header)
// decides which site's data it can see or write — on both the public
// storefront and the admin dashboard. Users/logins are NOT partitioned;
// the same account can be used on either domain.
//
// This mirrors the domain-matching already used for branding in
// src/app/place-new-order/page.tsx (the BRANDS array) — keep the matching
// rule ("jaeky.us") in sync with that file if it ever changes.

export type SiteId = "vipservice4u" | "jaeky";

const JAEKY_HOST_MATCH = "jaeky.us";

/** The original/default site. Legacy documents with no `site` field yet
 * (written before this partitioning existed) all belong to this site. */
export const DEFAULT_SITE: SiteId = "vipservice4u";

/**
 * Given a raw `Host` header value (e.g. "jaeky.us", "www.jaeky.us:3000",
 * "vipservice4u.us", or "localhost:3000"), return which site's data this
 * request should see/write. Anything that isn't recognizably Jaeky falls
 * back to vipservice4u, same as the BRANDS lookup used for the hero text.
 */
export function getSiteFromHost(host: string | null | undefined): SiteId {
  const normalized = (host || "").toLowerCase();
  return normalized.includes(JAEKY_HOST_MATCH) ? "jaeky" : DEFAULT_SITE;
}

/**
 * Convenience for Route Handlers: reads the Host header directly off the
 * incoming Request/NextRequest.
 */
export function getSiteFromRequest(request: Request): SiteId {
  return getSiteFromHost(request.headers.get("host"));
}

/**
 * Convenience for code that prefers Next's `headers()` API (e.g. Server
 * Components) instead of a Request object.
 */
export async function getSiteFromNextHeaders(): Promise<SiteId> {
  const { headers } = await import("next/headers");
  const headersList = await headers();
  return getSiteFromHost(headersList.get("host"));
}

/**
 * The Prisma `where` filter fragment that scopes a query to one site's
 * data.
 *
 * IMPORTANT (MongoDB + Prisma caveat): `@default("vipservice4u")` on the
 * `site` field only applies to writes made through Prisma from now on. It
 * does NOT retroactively add the field to documents that already existed
 * in the database. So every document created before this change has NO
 * `site` field at all (missing/undefined in Mongo, `null` as far as a
 * Prisma filter is concerned) — not the string "vipservice4u".
 *
 * Consequences:
 * - For "vipservice4u": match documents with `site: "vipservice4u"` (new
 *   writes) OR `site: null` (legacy documents — which all originally
 *   belonged to vipservice4u before Jaeky existed as a second site).
 * - For "jaeky": match ONLY `site: "jaeky"` exactly. There is no legacy
 *   Jaeky data, so no null-fallback — applying one would leak
 *   vipservice4u's old, untagged data into Jaeky's storefront/dashboard.
 *
 * Spread the result into a Prisma `where` object, e.g.:
 *   prisma.menuItems.findMany({ where: { ...siteWhere(site) } })
 * or combine with other conditions:
 *   prisma.menuItems.findMany({ where: { category, ...siteWhere(site) } })
 */
export function siteWhere(site: SiteId): Record<string, unknown> {
  if (site === "jaeky") {
    return { site: "jaeky" };
  }
  return { OR: [{ site: "vipservice4u" }, { site: null }] };
}

/**
 * The value to stamp onto a newly created record's `site` field so future
 * reads (on either domain) can tell it apart correctly. (Just returns the
 * site id — this helper exists mainly so call sites read clearly, e.g.
 * `data: { ...body, site: siteCreateValue(site) }`.)
 */
export function siteCreateValue(site: SiteId): SiteId {
  return site;
}
