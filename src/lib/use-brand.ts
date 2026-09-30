// src/lib/use-brand.ts
"use client";

import { useEffect, useState } from "react";
import { THEMES, siteFromHostname, type BrandTheme } from "@/lib/brand";

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
