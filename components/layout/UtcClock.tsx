"use client";

import { useEffect, useState } from "react";

const PLACEHOLDER = "--:--:-- UTC";

function formatUtc(date: Date): string {
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss} UTC`;
}

/**
 * Live UTC clock. Renders a fixed-width placeholder on the server and initial
 * client render (identical markup — no hydration mismatch, no layout shift),
 * then ticks once per second after mount.
 */
export function UtcClock({ className }: { className?: string }) {
  const [time, setTime] = useState<string>(PLACEHOLDER);

  useEffect(() => {
    const tick = () => setTime(formatUtc(new Date()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <time className={className} suppressHydrationWarning aria-label="Coordinated Universal Time">
      {time}
    </time>
  );
}
