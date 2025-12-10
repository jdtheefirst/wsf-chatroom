"use client";

import { useEffect } from "react";
import { fireConfetti } from "@/components/layout/ConfettiClient";

export function ConfettiOnMount({ once = true }: { once?: boolean }) {
  useEffect(() => {
    fireConfetti();
  }, [once]);

  return null;
}
