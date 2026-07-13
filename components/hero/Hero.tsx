"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

const PointCloudCanvas = dynamic(() => import("./PointCloudCanvas"), {
  ssr: false,
});

const RESCAN_THROTTLE_MS = 4000;
const MOBILE_BREAKPOINT = 768;

type Support = "pending" | "webgl" | "fallback";

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") || canvas.getContext("webgl"),
    );
  } catch {
    return false;
  }
}

export function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScan = useRef(0);

  const [support, setSupport] = useState<Support>("pending");
  const [reduced, setReduced] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [active, setActive] = useState(true);
  const [runToken, setRunToken] = useState(0);
  const [verts, setVerts] = useState<number | null>(null);
  const [fps, setFps] = useState<number | null>(null);

  const handleError = useCallback(() => setSupport("fallback"), []);

  // Detect capabilities after fonts settle so the scan begins with stable layout.
  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(motionQuery.matches);
    const onMotionChange = () => setReduced(motionQuery.matches);
    motionQuery.addEventListener("change", onMotionChange);

    const nav = navigator as Navigator & { deviceMemory?: number };
    const lowMemory = typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4;
    setMobile(window.innerWidth < MOBILE_BREAKPOINT || lowMemory);

    const resolve = () => setSupport(detectWebGL() ? "webgl" : "fallback");
    if (document.fonts?.ready) {
      document.fonts.ready.then(resolve, resolve);
    } else {
      resolve();
    }

    return () => motionQuery.removeEventListener("change", onMotionChange);
  }, []);

  // Pause the render loop when the hero scrolls off-screen or the tab is hidden.
  useEffect(() => {
    if (support !== "webgl") return;
    const el = containerRef.current;
    if (!el) return;

    let onScreen = true;
    const update = () =>
      setActive(onScreen && document.visibilityState === "visible");

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) onScreen = entry.isIntersecting;
        update();
      },
      { threshold: 0.05 },
    );
    observer.observe(el);
    document.addEventListener("visibilitychange", update);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [support]);

  const handleReScan = useCallback(() => {
    if (reduced) return;
    const now = Date.now();
    if (now - lastScan.current < RESCAN_THROTTLE_MS) return;
    lastScan.current = now;
    setRunToken((token) => token + 1);
  }, [reduced]);

  const interactive = support === "webgl" && !reduced;

  return (
    <div
      ref={containerRef}
      className={`relative aspect-square w-full border border-border ${
        interactive ? "cursor-pointer" : ""
      }`}
      onClick={interactive ? handleReScan : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleReScan();
              }
            }
          : undefined
      }
      role="img"
      aria-label="Point-cloud scan of Trey Harrison, sampled from a photogrammetry capture"
      tabIndex={interactive ? 0 : undefined}
    >
      {support === "webgl" && (
        <div className="absolute inset-0">
          <PointCloudCanvas
            mobile={mobile}
            reduced={reduced}
            runToken={runToken}
            active={active}
            onVerts={setVerts}
            onFps={setFps}
            onError={handleError}
          />
        </div>
      )}

      {support === "fallback" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/pointcloud-fallback.png"
          width={900}
          height={900}
          alt="Point-cloud scan of Trey Harrison"
          className="absolute inset-0 h-full w-full object-contain"
        />
      )}

      {/* HUD readouts — only real values are shown. */}
      <dl className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-0.5">
        {verts !== null && (
          <div className="flex gap-2">
            <dt className="label">VERTS</dt>
            <dd className="telemetry text-text-2">{verts.toLocaleString("en-US")}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="label">SRC</dt>
          <dd className="telemetry text-text-2">PHOTOGRAMMETRY</dd>
        </div>
        {fps !== null && (
          <div className="flex gap-2">
            <dt className="label">FPS</dt>
            <dd className="telemetry text-accent">{fps}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
