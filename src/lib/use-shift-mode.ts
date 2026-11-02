// src/lib/use-shift-mode.ts
"use client";

// "Start shift" for the order screens. Phones and browsers only allow a
// page to make sound after someone has tapped it, and screens go to sleep
// on their own. One tap on "Start shift" does both jobs for the rest of the
// shift: unlocks the new-order sound and keeps the screen awake (re-asked
// automatically whenever the page comes back to the front).

import { useEffect, useRef, useState } from "react";

export function useShiftMode() {
  const [shiftOn, setShiftOn] = useState(false);
  const [screenAwake, setScreenAwake] = useState(false);
  const wakeRef = useRef<WakeLockSentinel | null>(null);
  const wantAwakeRef = useRef(false);

  const requestWake = async () => {
    try {
      if (typeof navigator !== "undefined" && "wakeLock" in navigator) {
        wakeRef.current = await navigator.wakeLock.request("screen");
        setScreenAwake(true);
        wakeRef.current.addEventListener("release", () => setScreenAwake(false));
      }
    } catch {
      setScreenAwake(false);
    }
  };

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && wantAwakeRef.current) requestWake();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      wakeRef.current?.release().catch(() => {});
    };
  }, []);

  /** Call from a tap/click. `unlockSound` is the page's own code for
   * unlocking its alert sound (it owns the audio objects). */
  const startShift = async (unlockSound?: () => Promise<void> | void) => {
    try {
      await unlockSound?.();
    } catch {
      // Still locked: a later tap will retry.
    }
    wantAwakeRef.current = true;
    await requestWake();
    setShiftOn(true);
  };

  return { shiftOn, screenAwake, startShift };
}
