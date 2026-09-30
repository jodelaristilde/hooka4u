// src/lib/brand.ts
"use client";

import { useEffect, useState } from "react";

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

const THEMES: Record<SiteId, BrandTheme> = {
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

function siteFromHostname(hostname: string): SiteId {
  return hostname.toLowerCase().includes("jaeky.us") ? "jaeky" : "vipservice4u";
}

/**
 * Client-side hook for which site's branding to show. Starts with the
 * vipservice4u theme on every render (server-safe default, avoids a
 * hydration mismatch — same technique already used by the dashboard
 * sidebar's QR-code widget, HomepageQR in nav-projects.tsx) and swaps to
 * the real theme right after mount, once window.location.hostname is
 * available.
 */
export function useBrand(): BrandTheme {
  const [theme, setTheme] = useState<BrandTheme>(THEMES.vipservice4u);

  useEffect(() => {
    setTheme(THEMES[siteFromHostname(window.location.hostname)]);
  }, []);

  return theme;
}

/** Server-side equivalent, for Server Components that already have a Host header (e.g. via next/headers()). */
export function getBrandFromHost(host: string | null | undefined): BrandTheme {
  return THEMES[siteFromHostname(host || "")];
}
