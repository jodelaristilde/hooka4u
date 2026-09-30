"use client";

import { useEffect, useState } from "react";
import { Maximize, X } from "lucide-react";
import { useBrand } from "@/lib/use-brand";

// A single floating button, mounted once in the dashboard layout, so it
// shows up automatically on every dashboard page (New Order, All Orders,
// Menu, Menu Prices, Users Management, the home screen, all of it) without
// needing to add anything to each page individually.
//
// It uses the browser's Fullscreen API to enlarge whichever page you're
// currently on — same "Enlarge" feature the All Orders board already had,
// just available everywhere now. Browsers only allow entering fullscreen
// from a real click (not automatically on page load), so this can't turn
// itself on by itself — but once it's on, a clear "Exit" button appears so
// you can close it any time you don't need it, and it also turns itself
// off automatically if you leave fullscreen any other way (Esc key, etc).
export function EnlargeToggle() {
  const brand = useBrand();
  const isJaeky = brand.site === "jaeky";
  const [isFullscreen, setIsFullscreen] = useState(false);
  // While enlarged, the exit button stays out of the way (invisible and
  // un-clickable) until the cursor moves up near the top of the screen —
  // same pattern as a fullscreen video player's controls — so it never
  // sits on top of a page's own buttons (like All Orders' own "Enlarge"
  // button in that same corner) while you're not reaching for it.
  const [showExitButton, setShowExitButton] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isFullscreen) {
      setShowExitButton(false);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      setShowExitButton(e.clientY < 80);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [isFullscreen]);

  const enterFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.error("Error entering fullscreen:", err);
    }
  };

  const exitFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Error exiting fullscreen:", err);
    }
  };

  return (
    <>
      {/* While the page is enlarged (browser fullscreen), hide the sidebar
          nav icons — there's no reason to see the nav strip on a big TV
          display, and this frees up the whole screen for the content. The
          sidebar comes right back the moment fullscreen is exited. */}
      <style>{`:fullscreen [data-slot="sidebar"] { display: none !important; }`}</style>

      {isFullscreen ? (
        <button
          onClick={exitFullscreen}
          title="Exit enlarged view"
          className={`fixed top-3 right-3 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white shadow-lg backdrop-blur transition-opacity duration-200 hover:bg-black/90 ${
            showExitButton ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <X className="h-4 w-4" />
        </button>
      ) : (
        <button
          onClick={enterFullscreen}
          title="Enlarge this page"
          className={
            isJaeky
              ? "fixed bottom-4 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-purple-500 text-white shadow-lg transition-transform hover:scale-105 hover:bg-purple-400"
              : "fixed bottom-4 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-lime-500 text-zinc-950 shadow-lg transition-transform hover:scale-105 hover:bg-lime-400"
          }
        >
          <Maximize className="h-5 w-5" />
        </button>
      )}
    </>
  );
}
