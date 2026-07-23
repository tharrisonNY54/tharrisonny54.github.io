import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Volumetric-scan stage on the home page.
 *  - POINTS mode (default): the capture as a point cloud with a scanline sweep.
 *  - CAPTURE mode: the actual textured scan (lazy-loaded on first switch).
 *  - Drag to rotate; slow idle sway resumes after release.
 */

const POINTS_URL = '/data/points.bin';
const MESH_URL = '/data/scan.glb';
const FIGURE_HEIGHT = 2;
const BASE_YAW = Math.PI; // capture faces -Z in source coordinates
const SWEEP_PERIOD = 6;

type Mode = 'points' | 'mesh';

const vertexShader = /* glsl */ `
  uniform float uSize;
  uniform float uDpr;
  uniform float uSweepY;
  uniform float uStatic;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vBand;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float d = position.y - uSweepY;
    float band = exp(-d * d / 0.006);
    vBand = mix(band, 0.0, uStatic);
    float size = uSize * uDpr / max(-mv.z, 0.001);
    gl_PointSize = clamp(size * (1.0 + vBand * 0.7), 1.0, 5.0);
    vColor = aColor;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform float uStatic;
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vBand;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dd = dot(uv, uv);
    if (dd > 0.25) discard;
    float alpha = smoothstep(0.25, 0.1, dd) * uOpacity;
    vec3 col = min(pow(vColor, vec3(2.2)) * 2.1, vec3(1.0)); // exposure lift
    float base = mix(0.52, 1.0, uStatic);
    col *= base + vBand * 1.1;
    col = mix(col, vec3(0.62, 0.78, 0.81), vBand * 0.45);
    gl_FragColor = vec4(col, alpha);
  }
`;

async function loadPointsGeometry(): Promise<THREE.BufferGeometry> {
  const res = await fetch(POINTS_URL);
  if (!res.ok) throw new Error(`points ${res.status}`);
  const buf = await res.arrayBuffer();
  const view = new DataView(buf);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== 'PTS1') throw new Error('bad points header');
  const count = view.getUint32(4, true);
  const positions = new Float32Array(buf, 16, count * 3);
  const rawColors = new Uint8Array(buf, 16 + count * 3 * 4, count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < colors.length; i++) colors[i] = rawColors[i] / 255;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geo.computeBoundingSphere();
  return geo;
}

/** Center the loaded capture and scale it to the shared normalized height. */
function normalizeScan(scan: THREE.Object3D): THREE.Group {
  const box = new THREE.Box3().setFromObject(scan);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const holder = new THREE.Group();
  scan.position.sub(center);
  holder.add(scan);
  holder.scale.setScalar(FIGURE_HEIGHT / (size.y || 1));
  return holder;
}

async function start(mount: HTMLElement): Promise<void> {
  const stage = mount.closest<HTMLElement>('.scan-stage');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return;
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0.05, 3.75);

  const figure = new THREE.Group();
  figure.rotation.y = BASE_YAW;
  scene.add(figure);

  // ---- Points (default) ----
  let geo: THREE.BufferGeometry;
  try {
    geo = await loadPointsGeometry();
  } catch (err) {
    console.error('[scan]', err);
    renderer.dispose();
    return;
  }
  const pointsUniforms = {
    uSize: { value: 3.1 },
    uDpr: { value: dpr },
    uSweepY: { value: -1.3 },
    uStatic: { value: reduced ? 1 : 0 },
    uOpacity: { value: 1 },
  };
  const points = new THREE.Points(
    geo,
    new THREE.ShaderMaterial({
      uniforms: pointsUniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
    }),
  );
  figure.add(points);

  // ---- Textured capture (lazy) ----
  let meshHolder: THREE.Group | null = null;
  let meshLoading = false;
  const meshMaterials: THREE.Material[] = [];
  async function ensureMesh(): Promise<void> {
    if (meshHolder || meshLoading) return;
    meshLoading = true;
    try {
      const gltf = await new GLTFLoader().loadAsync(MESH_URL);
      meshHolder = normalizeScan(gltf.scene);
      meshHolder.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.isMesh) {
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          for (const mat of mats) {
            mat.transparent = true;
            mat.opacity = 0;
            meshMaterials.push(mat);
          }
        }
      });
      figure.add(meshHolder);
    } finally {
      meshLoading = false;
    }
  }

  // ---- Mode toggle ----
  let mode: Mode = 'points';
  const buttons = stage ? Array.from(stage.querySelectorAll<HTMLButtonElement>('.scan-mode button[data-mode]')) : [];
  const syncButtons = () => buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  buttons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const next = btn.dataset.mode as Mode;
      if (next === mode) return;
      if (next === 'mesh') {
        try {
          await ensureMesh();
        } catch (err) {
          console.error('[scan]', err);
          return;
        }
      }
      mode = next;
      syncButtons();
    });
  });
  syncButtons();

  const resize = () => {
    const w = mount.clientWidth || 1;
    const h = mount.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  // ---- Drag to rotate ----
  let yaw = BASE_YAW;
  let pitch = 0;
  let yawVel = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let lastInteraction = -10;
  const el = renderer.domElement;
  el.style.cursor = 'grab';
  el.style.touchAction = 'pan-y'; // keep vertical page scroll on touch
  el.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    el.setPointerCapture(e.pointerId);
    el.style.cursor = 'grabbing';
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    yaw += dx * 0.008;
    yawVel = dx * 0.008;
    pitch = THREE.MathUtils.clamp(pitch + dy * 0.004, -0.3, 0.3);
  });
  const endDrag = () => {
    dragging = false;
    el.style.cursor = 'grab';
  };
  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', endDrag);

  stage?.classList.add('ready');

  const clock = new THREE.Clock();
  let inView = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => (inView = entries[0].isIntersecting), { threshold: 0 }).observe(mount);
  }

  let meshOpacity = 0;
  function frame() {
    requestAnimationFrame(frame);
    if (!inView || document.hidden) return;
    const t = clock.getElapsedTime();

    // representation crossfade
    const meshTarget = mode === 'mesh' && meshHolder ? 1 : 0;
    meshOpacity += (meshTarget - meshOpacity) * 0.08;
    if (meshHolder) {
      meshHolder.visible = meshOpacity > 0.01;
      for (const m of meshMaterials) {
        m.opacity = meshOpacity;
        m.transparent = meshOpacity < 0.995;
      }
    }
    pointsUniforms.uOpacity.value += (1 - meshTarget - pointsUniforms.uOpacity.value) * 0.08;
    points.visible = pointsUniforms.uOpacity.value > 0.01;

    // sweep (points mode only)
    if (!reduced && mode === 'points') {
      const phase = (t % SWEEP_PERIOD) / SWEEP_PERIOD;
      pointsUniforms.uSweepY.value = -1.25 + Math.min(phase * 1.25, 1) * 2.5;
    }

    // rotation: drag has authority; inertia then idle sway
    if (dragging) {
      lastInteraction = t;
    } else {
      yaw += yawVel;
      yawVel *= 0.92;
      pitch *= 0.96;
      if (!reduced && t - lastInteraction > 3) {
        yaw += Math.cos(t * 0.14) * 0.0012; // gentle drift, matches old sway pace
      }
    }
    figure.rotation.y = yaw;
    figure.rotation.x = pitch;

    renderer.render(scene, camera);
  }
  frame();
}

export function initScan(): void {
  const mount = document.querySelector<HTMLElement>('.scan-stage__canvas');
  if (!mount) return;
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          io.disconnect();
          void start(mount);
        }
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(mount);
  } else {
    void start(mount);
  }
}
