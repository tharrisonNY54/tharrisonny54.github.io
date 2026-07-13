"use client";

import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";

import { loadPointCloud, type PointCloudData } from "@/lib/pointcloud";
import { PointCloudScene } from "./PointCloudScene";

const MOBILE_POINTS = 16_000;

interface PointCloudCanvasProps {
  mobile: boolean;
  reduced: boolean;
  runToken: number;
  active: boolean;
  onVerts: (count: number) => void;
  onFps: (fps: number) => void;
  onError: () => void;
}

/** Default export so it can be lazily `import()`-ed only when WebGL is available. */
export default function PointCloudCanvas({
  mobile,
  reduced,
  runToken,
  active,
  onVerts,
  onFps,
  onError,
}: PointCloudCanvasProps) {
  const [data, setData] = useState<PointCloudData | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadPointCloud("/pointcloud.bin", mobile ? MOBILE_POINTS : undefined)
      .then((loaded) => {
        if (cancelled) return;
        setData(loaded);
        onVerts(loaded.count);
      })
      .catch(() => {
        if (!cancelled) onError();
      });
    return () => {
      cancelled = true;
    };
  }, [mobile, onVerts, onError]);

  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 1.7], fov: 35 }}
    >
      {data && (
        <PointCloudScene
          data={data}
          reduced={reduced}
          mobile={mobile}
          runToken={runToken}
          onFps={onFps}
        />
      )}
    </Canvas>
  );
}
