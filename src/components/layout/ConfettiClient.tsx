"use client";

import confetti from "canvas-confetti";

export function fireConfetti({
  particleCount = 120,
  spread = 70,
  origin = { y: 0.6 },
  colors,
}: {
  particleCount?: number;
  spread?: number;
  origin?: { x?: number; y?: number };
  colors?: string[];
} = {}) {
  confetti({
    particleCount,
    spread,
    origin,
    colors,
  });
}
