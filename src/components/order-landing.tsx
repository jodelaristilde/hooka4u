"use client";

import { useState } from "react";
import Link from "next/link";
import NewOrder from "@/components/new-order";

type Screen = "hero" | "order";
type Theme = "dark-lime" | "dark-purple" | "light-purple";

interface OrderLandingProps {
  // Either pass topLine/bottomLine for a plain text hero (VIP Service 4U's
  // default), OR pass logoSrc (+ optional subLine/slogan) to show a logo
  // image instead (used for Jaeky). Both themes use the same dark
  // background — only the accent color (lime vs purple) and hero content
  // differ.
  topLine?: string;
  bottomLine?: string;
  logoSrc?: string;
  // Short accent line shown right under the logo (e.g. "GOT YOU"), set in
  // the same bold serif face as the wordmark itself.
  subLine?: string;
  slogan?: string;
  // Image version of the tagline (e.g. cropped straight from the logo
  // graphic), shown instead of the plain-text `slogan` when provided —
  // used so the tagline matches the wordmark's exact lettering.
  taglineSrc?: string;
  theme: Theme;
}

const THEME_CLASSES: Record<
  Theme,
  {
    mainBg: string;
    bgGradient: string;
    line: string;
    slogan: string;
    subLine: string;
    primaryBtn: string;
    primaryBtnHoverBg: string;
    primaryShadow: string;
    outlineBtn: string;
  }
> = {
  "dark-lime": {
    mainBg: "bg-gray-950",
    bgGradient: "from-gray-900 via-gray-950 to-black",
    line: "via-lime-500",
    slogan: "text-white/80",
    subLine: "from-lime-400 via-lime-500 to-lime-600",
    primaryBtn: "from-lime-400 to-lime-500",
    primaryBtnHoverBg: "from-lime-500 to-lime-600",
    primaryShadow: "0 10px 40px rgba(132, 204, 22, 0.5)",
    outlineBtn: "text-lime-400 border-lime-500/60 hover:bg-lime-500/10",
  },
  "dark-purple": {
    mainBg: "bg-gray-950",
    bgGradient: "from-gray-900 via-gray-950 to-black",
    line: "via-purple-500",
    slogan: "text-white/80",
    subLine: "from-purple-400 via-purple-500 to-purple-700",
    primaryBtn: "from-purple-400 to-purple-600",
    primaryBtnHoverBg: "from-purple-500 to-purple-700",
    primaryShadow: "0 10px 40px rgba(168, 85, 247, 0.5)",
    outlineBtn: "text-purple-300 border-purple-500/60 hover:bg-purple-500/10",
  },
  "light-purple": {
    mainBg: "bg-white",
    bgGradient: "from-purple-50 via-white to-white",
    line: "via-purple-400",
    slogan: "text-zinc-600",
    subLine: "from-purple-500 via-purple-600 to-purple-800",
    primaryBtn: "from-purple-500 to-purple-700",
    primaryBtnHoverBg: "from-purple-600 to-purple-800",
    primaryShadow: "0 10px 40px rgba(168, 85, 247, 0.35)",
    outlineBtn: "text-purple-700 border-purple-400 hover:bg-purple-50",
  },
};

// Same bold, high-contrast serif face used in the JaeKy wordmark itself
// (Playfair Display, weight 900), loaded here so "GOT YOU" reads as part
// of the same lettering system as the logo rather than a mismatched font.
const LOGO_FONT_STACK = "'Playfair Display', Georgia, serif";

export default function OrderLanding({
  topLine,
  bottomLine,
  logoSrc,
  subLine,
  slogan,
  taglineSrc,
  theme,
}: OrderLandingProps) {
  const [screen, setScreen] = useState<Screen>("hero");
  const c = THEME_CLASSES[theme];

  if (screen === "order") {
    return (
      <NewOrder
        onOrderComplete={() => {
          // Send the guest back to the home screen so they can either
          // start a new order or check their order's status.
          setScreen("hero");
        }}
      />
    );
  }

  return (
    <main className={`min-h-screen min-h-[100dvh] ${c.mainBg} relative overflow-x-hidden flex items-center justify-center py-10`}>
      {/* Next.js hoists this into <head> automatically since it's rendered
          from a component — loads the same serif face used in the logo. */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&display=swap"
      />
      <div className={`absolute inset-0 bg-gradient-to-b ${c.bgGradient}`}></div>
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className={`absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent ${c.line} to-transparent`}></div>
        <div className={`absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent ${c.line} to-transparent`}></div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 my-auto">
        {logoSrc ? (
          <div className="mb-10 sm:mb-16">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc}
              alt="Jaeky"
              className="mx-auto w-full max-w-lg sm:max-w-2xl md:max-w-3xl h-auto"
            />
            {subLine && (
              <p
                className={`-mt-2 sm:-mt-4 uppercase tracking-[0.2em] sm:tracking-[0.3em] text-4xl sm:text-6xl md:text-7xl font-black bg-gradient-to-r ${c.subLine} text-transparent bg-clip-text`}
                style={{ fontFamily: LOGO_FONT_STACK }}
              >
                {subLine}
              </p>
            )}
            {taglineSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={taglineSrc}
                alt=""
                className="mx-auto mt-4 sm:mt-6 w-full max-w-[260px] sm:max-w-sm md:max-w-md h-auto"
              />
            ) : (
              slogan && (
                <p
                  className={`mt-1 sm:mt-2 ${c.slogan} text-base sm:text-xl md:text-2xl tracking-wide`}
                  style={{ fontFamily: LOGO_FONT_STACK }}
                >
                  {slogan}
                </p>
              )
            )}
          </div>
        ) : (
          <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-bold mb-12 sm:mb-20 tracking-tight">
            <span className="block text-white mb-4" style={{ fontFamily: "Georgia, serif" }}>
              {topLine}
            </span>
            <span
              className="block bg-gradient-to-r from-lime-400 via-lime-500 to-lime-600 text-transparent bg-clip-text"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {bottomLine}
            </span>
          </h1>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={() => setScreen("order")}
            className={`group relative px-12 sm:px-20 py-4 sm:py-6 text-lg sm:text-xl md:text-2xl font-semibold text-black bg-gradient-to-r ${c.primaryBtn} overflow-hidden transition-all duration-500 hover:scale-105`}
            style={{
              fontFamily: "Georgia, serif",
              letterSpacing: "0.05em",
              boxShadow: c.primaryShadow,
            }}
          >
            <span className="relative z-10 uppercase">View Items</span>
            <div className={`absolute inset-0 bg-gradient-to-r ${c.primaryBtnHoverBg} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>
          </button>

          <Link
            href="/order-status"
            className={`group relative px-12 sm:px-20 py-4 sm:py-6 text-lg sm:text-xl md:text-2xl font-semibold border-2 overflow-hidden transition-all duration-500 hover:scale-105 ${c.outlineBtn}`}
            style={{
              fontFamily: "Georgia, serif",
              letterSpacing: "0.05em",
            }}
          >
            <span className="relative z-10 uppercase">Check Status</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
