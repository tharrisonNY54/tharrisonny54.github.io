import * as THREE from 'three';

/**
 * Procedural point-cloud rendition of the Aspera SmallSat, echoing the hero.
 * Geometry is sampled from simple primitives assembled to match the real
 * spacecraft's silhouette: bus, telescope aperture, two solar wings.
 * No external model ships — a few kilobytes of code generate ~26k points.
 */

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uDpr;
  attribute vec3 aColor;
  attribute float aSeed;
  varying vec3 vColor;
  varying float vDepth;

  void main() {
    vec3 p = position;
    // faint structural shimmer — reads as sensor noise, not wobble
    p += normalize(p + 1e-4) * sin(uTime * 1.4 + aSeed * 6.2831) * 0.004;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = uSize * uDpr * (1.0 / max(-mv.z, 0.001));
    gl_PointSize = clamp(size, 1.0, 5.0);
    vColor = aColor;
    vDepth = smoothstep(-2.5, -7.0, mv.z);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec3 vColor;
  varying float vDepth;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dd = dot(uv, uv);
    if (dd > 0.25) discard;
    float alpha = smoothstep(0.25, 0.05, dd);
    vec3 col = mix(vColor, vColor * 0.45, vDepth * 0.7);
    gl_FragColor = vec4(col, alpha * 0.95);
  }
`;

type Vec3 = [number, number, number];

interface Cloud {
  positions: number[];
  colors: number[];
  seeds: number[];
}

function pushPoint(cloud: Cloud, p: Vec3, c: Vec3): void {
  cloud.positions.push(p[0], p[1], p[2]);
  cloud.colors.push(c[0], c[1], c[2]);
  cloud.seeds.push(Math.random());
}

/** Sample the surface of an axis-aligned box centered at `center`. */
function sampleBox(cloud: Cloud, center: Vec3, size: Vec3, count: number, color: Vec3, jitter = 0.9): void {
  const [sx, sy, sz] = size;
  const areas = [sy * sz, sy * sz, sx * sz, sx * sz, sx * sy, sx * sy];
  const total = areas.reduce((a, b) => a + b, 0);
  for (let i = 0; i < count; i++) {
    let r = Math.random() * total;
    let face = 0;
    while (r > areas[face]) {
      r -= areas[face];
      face++;
    }
    const u = Math.random() - 0.5;
    const v = Math.random() - 0.5;
    let p: Vec3;
    switch (face) {
      case 0: p = [0.5 * sx, u * sy, v * sz]; break;
      case 1: p = [-0.5 * sx, u * sy, v * sz]; break;
      case 2: p = [u * sx, 0.5 * sy, v * sz]; break;
      case 3: p = [u * sx, -0.5 * sy, v * sz]; break;
      case 4: p = [u * sx, v * sy, 0.5 * sz]; break;
      default: p = [u * sx, v * sy, -0.5 * sz]; break;
    }
    const shade = 0.82 + Math.random() * 0.36 * jitter;
    pushPoint(
      cloud,
      [center[0] + p[0], center[1] + p[1], center[2] + p[2]],
      [color[0] * shade, color[1] * shade, color[2] * shade],
    );
  }
}

/** Sample a flat panel (solar wing) with a visible cell grid pattern. */
function samplePanel(cloud: Cloud, center: Vec3, w: number, h: number, count: number): void {
  const cell = 0.09;
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * w;
    const y = (Math.random() - 0.5) * h;
    const gx = Math.abs((x / cell) % 1 - 0.5);
    const gy = Math.abs((y / cell) % 1 - 0.5);
    const onGrid = gx > 0.44 || gy > 0.44;
    // deep blue photovoltaic cells with pale silver gridlines
    const c: Vec3 = onGrid
      ? [0.8, 0.83, 0.87]
      : [0.1 + Math.random() * 0.05, 0.15 + Math.random() * 0.06, 0.32 + Math.random() * 0.1];
    pushPoint(cloud, [center[0] + x, center[1] + y, center[2] + (Math.random() - 0.5) * 0.008], c);
  }
}

/** Sample a vertical-axis cylinder ring (telescope aperture, opening up). */
function sampleCylinder(cloud: Cloud, center: Vec3, radius: number, depth: number, count: number, color: Vec3): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const edge = Math.random() < 0.8;
    const r = edge ? radius * (0.94 + Math.random() * 0.06) : radius * Math.sqrt(Math.random());
    const y = edge ? (Math.random() - 0.5) * depth : -depth * 0.5;
    const shade = 0.7 + Math.random() * 0.5;
    pushPoint(
      cloud,
      [center[0] + Math.cos(a) * r, center[1] + y, center[2] + Math.sin(a) * r],
      [color[0] * shade, color[1] * shade, color[2] * shade],
    );
  }
}

function buildSatellite(): THREE.BufferGeometry {
  const cloud: Cloud = { positions: [], colors: [], seeds: [] };

  // Flight-hardware palette.
  const silver: Vec3 = [0.74, 0.77, 0.82];
  const darkPanel: Vec3 = [0.16, 0.17, 0.2];
  const mliGold: Vec3 = [0.78, 0.6, 0.24];
  const white: Vec3 = [0.93, 0.94, 0.97];

  // Main bus — silver upper section, MLI-wrapped lower section.
  sampleBox(cloud, [0, 0.12, 0], [0.6, 0.7, 0.55], 9600, silver);
  sampleBox(cloud, [0, -0.42, 0], [0.64, 0.34, 0.59], 4600, mliGold, 1.4); // crinkly blanket shimmer
  // Corner rails along the bus verticals — gives the box a machined edge.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      sampleBox(cloud, [sx * 0.3, 0.12, sz * 0.275], [0.03, 0.72, 0.03], 420, white, 0.3);
    }
  }
  // Radiator plate on one face.
  sampleBox(cloud, [0.315, 0.15, 0], [0.015, 0.52, 0.42], 1400, white, 0.3);
  // Dark instrument panel with access ports on the front face.
  sampleBox(cloud, [-0.05, 0.05, 0.285], [0.42, 0.4, 0.015], 1600, darkPanel);
  sampleBox(cloud, [-0.16, -0.06, 0.295], [0.09, 0.09, 0.012], 220, white, 0.3);
  sampleBox(cloud, [-0.02, -0.06, 0.295], [0.09, 0.09, 0.012], 220, white, 0.3);
  // Telescope aperture — gold ring opening upward, with a dark baffle throat.
  sampleCylinder(cloud, [0.05, 0.56, 0.08], 0.16, 0.18, 2200, mliGold);
  sampleCylinder(cloud, [0.05, 0.5, 0.08], 0.115, 0.06, 700, darkPanel);
  // Star tracker + comm patch antenna.
  sampleBox(cloud, [-0.2, 0.52, -0.18], [0.1, 0.12, 0.1], 550, darkPanel);
  sampleCylinder(cloud, [0.2, -0.62, 0.12], 0.07, 0.03, 380, white);
  // Greebles — small avionics boxes on the side faces.
  sampleBox(cloud, [-0.315, 0.28, 0.1], [0.02, 0.12, 0.16], 300, darkPanel);
  sampleBox(cloud, [-0.315, -0.02, -0.12], [0.02, 0.16, 0.1], 300, silver);

  // Solar wings — clear of the bus, canted like the orbit render.
  const wing = new THREE.Object3D();
  const wingCloud: Cloud = { positions: [], colors: [], seeds: [] };
  samplePanel(wingCloud, [0, 0, 0], 0.5, 1.15, 8400);

  const addWing = (side: 1 | -1) => {
    wing.position.set(side * 0.95, 0.12, 0);
    wing.rotation.set(0, side * 0.26, side * 0.08);
    wing.updateMatrix();
    const m = wing.matrix;
    const v = new THREE.Vector3();
    for (let i = 0; i < wingCloud.seeds.length; i++) {
      v.set(wingCloud.positions[i * 3], wingCloud.positions[i * 3 + 1], wingCloud.positions[i * 3 + 2]);
      v.applyMatrix4(m);
      pushPoint(
        cloud,
        [v.x, v.y, v.z],
        [wingCloud.colors[i * 3], wingCloud.colors[i * 3 + 1], wingCloud.colors[i * 3 + 2]],
      );
    }
    // boom arm + hinge block at the wing root
    sampleBox(cloud, [side * 0.6, 0.12, 0], [0.52, 0.028, 0.028], 460, silver);
    sampleBox(cloud, [side * 0.84, 0.12, 0], [0.06, 0.07, 0.06], 260, darkPanel);
  };
  addWing(1);
  addWing(-1);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(cloud.positions, 3));
  geo.setAttribute('aColor', new THREE.Float32BufferAttribute(cloud.colors, 3));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(cloud.seeds, 1));
  geo.computeBoundingSphere();
  return geo;
}

export function initSatellite(): void {
  const mount = document.querySelector<HTMLElement>('.sat-stage__canvas');
  if (!mount) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return;
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0.6, 5.4);
  camera.lookAt(0, 0, 0);

  const uniforms = {
    uTime: { value: 0 },
    uSize: { value: 4.2 },
    uDpr: { value: dpr },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
  });
  const sat = new THREE.Points(buildSatellite(), material);
  sat.rotation.x = 0.18;
  scene.add(sat);

  const resize = () => {
    const w = mount.clientWidth || 1;
    const h = mount.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // On the wide work-page hero, shift the craft right so the intro text
    // stays clear; center it in narrow layouts.
    const wide = w / h > 1.05;
    sat.position.x = wide ? 0.8 : 0;
    sat.position.y = wide ? 0 : 0.25;
  };
  resize();
  window.addEventListener('resize', resize);

  // Pointer nudges the tumble axis slightly; otherwise a slow steady spin.
  let targetTilt = 0.18;
  mount.addEventListener(
    'pointermove',
    (e) => {
      const rect = mount.getBoundingClientRect();
      targetTilt = 0.18 + ((e.clientY - rect.top) / rect.height - 0.5) * 0.3;
    },
    { passive: true },
  );

  const clock = new THREE.Clock();
  let inView = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => (inView = entries[0].isIntersecting), { threshold: 0 }).observe(mount);
  }

  function frame() {
    requestAnimationFrame(frame);
    if (!inView || document.hidden) return;
    const t = clock.getElapsedTime();
    uniforms.uTime.value = t;
    if (!reduced) {
      // Oscillate around a three-quarter view instead of tumbling —
      // every frame stays a readable silhouette.
      sat.rotation.y = 0.55 + Math.sin(t * 0.18) * 0.18;
      sat.rotation.x += (targetTilt - sat.rotation.x) * 0.04;
    }
    renderer.render(scene, camera);
  }
  frame();
}
