// src/lib/brand.ts
//
// Server-safe brand data — plain types/constants/functions only, NO React
// hooks and NO "use client" directive, so it can be imported from Server
// Components (the root layout, the dashboard layout, the dashboard home
// page) as well as from client code. The client-only useBrand() hook lives
// in a separate file, src/lib/use-brand.ts, specifically so this file can
// stay server-safe — mixing a hook export into a file that Server
// Components also import causes a build error ("Attempted to call ... from
// the server" / a Client Component SSR graph conflict).

export type SiteId = "vipservice4u" | "jaeky";

export interface BrandTheme {
  site: SiteId;
  name: string;
  shortName: string;
  logoSrc: string | null;
  tagline: string;
  accentText: string;
  accentTextStrong: string;
  accentBg: string;
  accentBgSoft: string;
  accentBorder: string;
  accentGradient: string;
  accentRing: string;
  bannerGradient: string;
}

export const THEMES: Record<SiteId, BrandTheme> = {
  vipservice4u: {
    site: "vipservice4u",
    name: "VIP Service 4U",
    shortName: "VIP SERVICE 4U",
    logoSrc: null,
    tagline: "Everything you need to run the floor tonight, all in one place.",
    accentText: "text-lime-600",
    accentTextStrong: "text-lime-700",
    accentBg: "bg-lime-500",
    accentBgSoft: "bg-lime-100",
    accentBorder: "border-lime-500",
    accentGradient: "from-lime-400 to-lime-500",
    accentRing: "ring-lime-500",
    bannerGradient: "from-lime-200 via-lime-50 to-white",
  },
  jaeky: {
    site: "jaeky",
    name: "Jaeky",
    shortName: "JAEKY",
    logoSrc: "/jaeky-logo.png",
    tagline: "Just About Everything, Kindly Yours",
    accentText: "text-purple-600",
    accentTextStrong: "text-purple-700",
    accentBg: "bg-purple-500",
    accentBgSoft: "bg-purple-100",
    accentBorder: "border-purple-500",
    accentGradient: "from-purple-400 to-purple-600",
    accentRing: "ring-purple-500",
    bannerGradient: "from-purple-200 via-purple-50 to-white",
  },
};

export function siteFromHostname(hostname: string): SiteId {
  return hostname.toLowerCase().includes("jaeky.us") ? "jaeky" : "vipservice4u";
}

/** Server-side equivalent, for Server Components that already have a Host header (e.g. via next/headers()). */
export function getBrandFromHost(host: string | null | undefined): BrandTheme {
  return THEMES[siteFromHostname(host || "")];
}
