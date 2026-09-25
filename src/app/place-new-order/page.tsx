"use client";

import { useState } from "react";
import NewOrder from "@/components/new-order";

type Screen = "hero" | "category" | "order";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("hero");
  const [category, setCategory] = useState<"FOOD" | "DRINKS" | null>(null);

  const chooseCategory = (cat: "FOOD" | "DRINKS") => {
    setCategory(cat);
    setScreen("order");
  };

  if (screen === "order" && category) {
    return (
      <NewOrder
        category={category}
        onBack={() => setScreen("category")}
        onOrderComplete={() => {
          setScreen("hero");
          setCategory(null);
        }}
      />
    );
  }

  if (screen === "category") {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="max-w-3xl w-full text-center">
          <h1
            className="text-3xl sm:text-5xl font-bold text-white mb-12"
            style={{ fontFamily: "Georgia, serif" }}
          >
            What are you in the mood for?
          </h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <button
              onClick={() => chooseCategory("FOOD")}
              className="py-12 px-6 rounded-2xl bg-gradient-to-r from-lime-400 to-lime-500 text-black text-2xl font-semibold uppercase tracking-wide hover:scale-105 transition-transform"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Food
            </button>
            <button
              onClick={() => chooseCategory("DRINKS")}
              className="py-12 px-6 rounded-2xl bg-gradient-to-r from-lime-400 to-lime-500 text-black text-2xl font-semibold uppercase tracking-wide hover:scale-105 transition-transform"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Drinks
            </button>
          </div>
        </div>
      </main>
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
        <div className="flex justify-center">
          <button
            onClick={() => setScreen("category")}
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
        </div>
      </div>
    </main>
  );
}
