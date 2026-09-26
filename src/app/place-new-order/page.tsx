"use client";

import { useState } from "react";
import Link from "next/link";
import NewOrder from "@/components/new-order";

type Screen = "hero" | "order";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("hero");

  if (screen === "order") {
    return (
      <NewOrder
        onOrderComplete={() => {
          // Order is placed and the cart/name/seating are already reset
          // inside NewOrder — stay right here so the next customer can
          // start ordering immediately, with no extra tap needed.
        }}
      />
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 relative overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-950 to-black"></div>
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-lime-500 to-transparent"></div>
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-lime-500 to-transparent"></div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-bold mb-12 sm:mb-20 tracking-tight">
          <span className="block text-white mb-4" style={{ fontFamily: "Georgia, serif" }}>
            Welcome To
          </span>
          <span
            className="block bg-gradient-to-r from-lime-400 via-lime-500 to-lime-600 text-transparent bg-clip-text"
            style={{ fontFamily: "Georgia, serif" }}
          >
            VIP SERVICE 4U
          </span>
        </h1>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={() => setScreen("order")}
            className="group relative px-12 sm:px-20 py-4 sm:py-6 text-lg sm:text-xl md:text-2xl font-semibold text-black bg-gradient-to-r from-lime-400 to-lime-500 overflow-hidden transition-all duration-500 hover:scale-105"
            style={{
              fontFamily: "Georgia, serif",
              letterSpacing: "0.05em",
              boxShadow: "0 10px 40px rgba(132, 204, 22, 0.5)",
            }}
          >
            <span className="relative z-10 uppercase">View Items</span>
            <div className="absolute inset-0 bg-gradient-to-r from-lime-500 to-lime-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          </button>

          <Link
            href="/order-status"
            className="group relative px-12 sm:px-20 py-4 sm:py-6 text-lg sm:text-xl md:text-2xl font-semibold text-lime-400 border-2 border-lime-500/60 overflow-hidden transition-all duration-500 hover:scale-105 hover:bg-lime-500/10"
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
