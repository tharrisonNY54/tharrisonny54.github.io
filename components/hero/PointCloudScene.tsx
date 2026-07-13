"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import type { PointCloudData } from "@/lib/pointcloud";
import { fragmentShader, vertexShader } from "./shaders";

const SCAN_SECONDS = 2.2;
const IDLE_YAW = 0.04; // rad/s
const PARALLAX_RAD = 0.052; // ~3 degrees
const PARALLAX_DAMP = 0.03;

interface PointCloudSceneProps {
  data: PointCloudData;
  reduced: boolean;
  mobile: boolean;
  runToken: number;
  onFps: (fps: number) => void;
}

export function PointCloudScene({
  data,
  reduced,
  mobile,
  runToken,
  onFps,
}: PointCloudSceneProps) {
  const { size, gl, pointer } = useThree();

  const parallaxRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);
  const scanRef = useRef<THREE.Mesh>(null);

  const animatingRef = useRef(false);
  const startRef = useRef(-1);
  const fpsFrames = useRef(0);
  const fpsElapsed = useRef(0);

  const uniforms = useMemo(
    () => ({
      // uProgress is the scan-head height in ny-space: travels below the feet
      // (-0.2) to above the head (1.2) so every point fully settles.
      uProgress: { value: reduced ? 1.2 : -0.2 },
      uTime: { value: 0 },
      uPointSize: { value: 3 },
      uPixelRatio: { value: 1 },
      uReduced: { value: reduced ? 1 : 0 },
      uColorBase: { value: new THREE.Color("#e5e5e5") },
      uColorAccent: { value: new THREE.Color("#22d3ee") },
    }),
    [reduced],
  );

  const points = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(data.positions, 3, true),
    );
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(data.seeds, 1));
    geometry.setAttribute("aCyan", new THREE.BufferAttribute(data.cyan, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      uniforms,
    });

    return new THREE.Points(geometry, material);
  }, [data, uniforms]);

  useEffect(() => {
    return () => {
      points.geometry.dispose();
      (points.material as THREE.Material).dispose();
    };
  }, [points]);

  // Kick off (or restart) the scan when the run token changes. Reduced motion
  // skips straight to the assembled state.
  useEffect(() => {
    if (reduced) {
      uniforms.uProgress.value = 1.2;
      animatingRef.current = false;
      return;
    }
    startRef.current = -1;
    animatingRef.current = true;
    if (scanRef.current) scanRef.current.visible = true;
  }, [runToken, reduced, uniforms]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    uniforms.uTime.value = t;
    uniforms.uPixelRatio.value = gl.getPixelRatio();
    uniforms.uPointSize.value = THREE.MathUtils.clamp(size.height * 0.006, 2, 6);

    if (animatingRef.current) {
      if (startRef.current < 0) startRef.current = t;
      const p = Math.min((t - startRef.current) / SCAN_SECONDS, 1);
      const scanHead = THREE.MathUtils.lerp(-0.2, 1.2, p); // ny-space
      uniforms.uProgress.value = scanHead;

      if (scanRef.current) {
        scanRef.current.position.y = scanHead - 0.5; // ny -> world Y
        const fade = 1 - THREE.MathUtils.smoothstep(p, 0.9, 1);
        (scanRef.current.material as THREE.MeshBasicMaterial).opacity = 0.9 * fade;
      }

      if (p >= 1) {
        animatingRef.current = false;
        if (scanRef.current) scanRef.current.visible = false;
      }
    }

    if (!reduced && spinRef.current) {
      spinRef.current.rotation.y += IDLE_YAW * delta;
    }

    if (!reduced && !mobile && parallaxRef.current) {
      const wantY = pointer.x * PARALLAX_RAD;
      const wantX = -pointer.y * PARALLAX_RAD;
      parallaxRef.current.rotation.y +=
        (wantY - parallaxRef.current.rotation.y) * PARALLAX_DAMP;
      parallaxRef.current.rotation.x +=
        (wantX - parallaxRef.current.rotation.x) * PARALLAX_DAMP;
    }

    fpsFrames.current += 1;
    fpsElapsed.current += delta;
    if (fpsElapsed.current >= 0.5) {
      onFps(Math.round(fpsFrames.current / fpsElapsed.current));
      fpsFrames.current = 0;
      fpsElapsed.current = 0;
    }
  });

  return (
    <>
      <group ref={parallaxRef}>
        <group ref={spinRef}>
          <primitive object={points} />
        </group>
      </group>

      <mesh ref={scanRef} visible={!reduced}>
        <planeGeometry args={[0.7, 0.006]} />
        <meshBasicMaterial
          color="#22d3ee"
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
}
