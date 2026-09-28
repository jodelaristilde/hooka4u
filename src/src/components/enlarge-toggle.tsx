"use client";

import { useEffect, useState } from "react";
import { Maximize, X } from "lucide-react";

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
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

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

  if (isFullscreen) {
    return (
      <button
        onClick={exitFullscreen}
        title="Exit enlarged view"
        className="fixed top-3 right-3 z-50 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-2 text-xs font-medium text-white shadow-lg backdrop-blur transition-colors hover:bg-black/90"
      >
        <X className="h-3.5 w-3.5" />
        Exit
      </button>
    );
  }

  return (
    <button
      onClick={enterFullscreen}
      title="Enlarge this page"
      className="fixed bottom-4 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-lime-500 text-zinc-950 shadow-lg transition-transform hover:scale-105 hover:bg-lime-400"
    >
      <Maximize className="h-5 w-5" />
    </button>
  );
}
