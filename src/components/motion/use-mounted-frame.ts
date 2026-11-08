"use client";

import { useEffect, useState } from "react";

/** false on the first frame, true from the next one: lets a bar grow from 0 to its value. */
export function useMountedFrame(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return mounted;
}
