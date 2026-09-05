import * as THREE from 'three';

/**
 * The constellation index: the home page's second way around.
 *
 * Four destinations floating in a field of points that came off the figure
 * above. Pointing at one pulls its share of the field into a tight cluster
 * behind the label; letting go lets them drift back out. It is the same
 * material as the hero, doing a different job — which is the reason this
 * exists rather than a second row of links.
 *
 * The links themselves are real anchors written in the HTML. This module only
 * measures where they landed and draws behind them, so the index works with
 * the script blocked, with WebGL unavailable, and from the keyboard. Nothing
 * here is load-bearing for navigation.
 */

const POINT_COUNT = 5_200;

/**
 * Idle spread of a node's cluster, in world units.
 *
 * Spread wide, 5,200 points over a section this size thin out into an empty
 * starfield with no relationship to the labels. Held closer, each destination
 * sits in a visible haze that the pull then gathers.
 */
const LOOSE_RADIUS = 0.26;

/**
 * Clearance between the gathered ring and the edge of the label box, in px.
 *
 * The gathered points ring the label rather than piling up behind it. Landing
 * them on the centre reads as a bug: the type and its shadow cover the densest
 * part of the cluster, so all that shows is the spill out one side.
 */
const RING_GAP = 26;

const vertexShader = /* glsl */ `
  uniform float uDpr;
  uniform float uSize;
  uniform float uTime;
  uniform vec4  uPull;     // per-node 0-1, set by hover and focus
  uniform float uDrift;

  attribute vec4 aNode;    // one-hot: which destination this point belongs to
  attribute vec3 aLoose;
  attribute vec3 aTight;
  attribute float aSeed;

  varying float vPull;

  void main() {
    /* One-hot dot product rather than an index: GLSL ES 1.0 cannot index a
       uniform array dynamically, and this costs three extra multiplies. */
    float pull = dot(aNode, uPull);
    vPull = pull;

    vec3 pos = mix(aLoose, aTight, pull);

    /* Idle drift, per point, so the field never reads as a frozen texture. */
    float a = uTime * 0.22 + aSeed * 6.283;
    pos.x += sin(a) * 0.03 * uDrift;
    pos.y += cos(a * 0.8) * 0.025 * uDrift;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = clamp(uSize * uDpr * (1.0 + pull * 0.7), 1.0, 4.5);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform float uGain;
  varying float vPull;

  const vec3 IDLE = vec3(0.170, 0.400, 0.470);
  const vec3 LIVE = vec3(0.620, 0.960, 1.000);

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dd = dot(uv, uv);
    if (dd > 0.25) discard;
    float alpha = smoothstep(0.25, 0.06, dd) * (0.55 + vPull * 0.45);
    if (alpha < 0.01) discard;

    vec3 col = mix(IDLE, LIVE, vPull);
    /* Premultiplied additive, matching the hero: no depth sort happens here
       either, and adding is the only order-independent option. */
    gl_FragColor = vec4(col * alpha * uGain, alpha);
  }
`;

/** Box-Muller, so clusters fall off smoothly instead of ending at a hard rim. */
function gaussian(): number {
  let u = 0;
  while (u === 0) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}

export function initConstellation(): void {
  const mount = document.querySelector<HTMLElement>('.constel__canvas');
  const section = document.querySelector<HTMLElement>('.constel');
  if (!mount || !section) return;

  const links = Array.from(section.querySelectorAll<HTMLAnchorElement>('.constel__node'));
  if (links.length !== 4) return; // uPull is a vec4; the two have to agree.

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return; // The anchors are already on screen and already work.
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  /* Orthographic and normalised to the mount, so a point's world position maps
     one-to-one onto where the anchor actually sits in the layout. The clusters
     then track the links through any reflow without a second set of numbers to
     keep in sync. */
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 1;

  const node = new Float32Array(POINT_COUNT * 4);
  const loose = new Float32Array(POINT_COUNT * 3);
  const tight = new Float32Array(POINT_COUNT * 3);
  const seed = new Float32Array(POINT_COUNT);

  /* Offsets are generated once in unit space and re-centred on each rebuild,
     so a resize moves the clusters without reshuffling every point. */
  const offLoose = new Float32Array(POINT_COUNT * 2);
  const offTight = new Float32Array(POINT_COUNT * 2);
  for (let n = 0; n < POINT_COUNT; n++) {
    const which = n % 4;
    node[n * 4 + which] = 1;
    seed[n] = Math.random();
    offLoose[n * 2] = gaussian();
    offLoose[n * 2 + 1] = gaussian();
    /* The gathered form is a ring, so these are an angle and a radial wobble
       rather than a second pair of cartesian offsets. */
    offTight[n * 2] = Math.random() * Math.PI * 2;
    offTight[n * 2 + 1] = gaussian();
  }

  const geo = new THREE.BufferGeometry();
  const looseAttr = new THREE.BufferAttribute(loose, 3);
  const tightAttr = new THREE.BufferAttribute(tight, 3);
  geo.setAttribute('position', looseAttr); // never read; keeps three happy
  geo.setAttribute('aLoose', looseAttr);
  geo.setAttribute('aTight', tightAttr);
  geo.setAttribute('aNode', new THREE.BufferAttribute(node, 4));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

  const uniforms = {
    uDpr: { value: dpr },
    uSize: { value: 2.4 },
    uTime: { value: 0 },
    uPull: { value: new THREE.Vector4(0, 0, 0, 0) },
    uGain: { value: 1.9 },
    uDrift: { value: reduced ? 0 : 1 },
  };

  scene.add(
    new THREE.Points(
      geo,
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        blendEquation: THREE.AddEquation,
      }),
    ),
  );

  /** Re-measure the anchors and rebuild both cluster layouts around them. */
  const layout = (): void => {
    const w = mount.clientWidth || 1;
    const h = mount.clientHeight || 1;
    const aspect = w / h;

    renderer.setSize(w, h, false);
    camera.left = -aspect;
    camera.right = aspect;
    camera.updateProjectionMatrix();

    const box = mount.getBoundingClientRect();
    /* Each label's own box gives the ring its radii, so the halo traces the
       shape of the destination it belongs to instead of every node getting the
       same circle regardless of how long its name is. */
    const centres = links.map((a) => {
      const r = a.getBoundingClientRect();
      const cx = r.left + r.width / 2 - box.left;
      const cy = r.top + r.height / 2 - box.top;
      return {
        x: (cx / w) * 2 * aspect - aspect,
        y: -((cy / h) * 2 - 1),
        rx: ((r.width / 2 + RING_GAP) / w) * 2 * aspect,
        ry: ((r.height / 2 + RING_GAP) / h) * 2,
      };
    });

    for (let n = 0; n < POINT_COUNT; n++) {
      const c = centres[n % 4];
      loose[n * 3] = c.x + offLoose[n * 2] * LOOSE_RADIUS * aspect * 0.6;
      loose[n * 3 + 1] = c.y + offLoose[n * 2 + 1] * LOOSE_RADIUS;
      loose[n * 3 + 2] = 0;

      const ang = offTight[n * 2];
      /* Wobble the radius so the ring reads as a gathered cloud settling onto
         an orbit, not as a drawn ellipse. */
      const wobble = 1 + offTight[n * 2 + 1] * 0.14;
      tight[n * 3] = c.x + Math.cos(ang) * c.rx * wobble;
      tight[n * 3 + 1] = c.y + Math.sin(ang) * c.ry * wobble;
      tight[n * 3 + 2] = 0;
    }
    looseAttr.needsUpdate = true;
    tightAttr.needsUpdate = true;
  };
  layout();
  window.addEventListener('resize', layout);

  /*
   * Re-measure whenever the anchors actually move.
   *
   * Measuring once at module-eval time is not enough: at that point the
   * stylesheet's translate(-50%, -50%) has not necessarily been applied, so
   * every rect comes back offset by half a label and the clusters settle down
   * and to the right of the words they belong to. Watching the elements
   * themselves also covers the webfont swap, which resizes every label.
   */
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(layout);
    ro.observe(mount);
    links.forEach((a) => ro.observe(a));
  } else {
    /* Older engines: catch the two moments that actually move these boxes. */
    document.fonts?.ready.then(layout);
    window.addEventListener('load', layout);
  }

  /*
   * Hover and keyboard focus drive the same target, so tabbing through the
   * index produces exactly what pointing at it does.
   */
  const target = [0, 0, 0, 0];
  const current = [0, 0, 0, 0];
  links.forEach((a, i) => {
    const on = (): void => {
      target.fill(0);
      target[i] = 1;
    };
    const off = (): void => {
      target[i] = 0;
    };
    a.addEventListener('pointerenter', on);
    a.addEventListener('pointerleave', off);
    a.addEventListener('focus', on);
    a.addEventListener('blur', off);
  });

  const clock = new THREE.Clock();
  let inView = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((e) => (inView = e[0].isIntersecting), { threshold: 0 }).observe(
      section,
    );
  }

  mount.classList.add('ready');

  function frame(): void {
    requestAnimationFrame(frame);
    if (!inView || document.hidden) return;

    uniforms.uTime.value = clock.getElapsedTime();

    /* Eased rather than switched, so the cluster gathers and releases instead
       of snapping between two states as the pointer crosses a label. */
    const v = uniforms.uPull.value;
    for (let i = 0; i < 4; i++) {
      current[i] += (target[i] - current[i]) * (reduced ? 1 : 0.12);
      v.setComponent(i, current[i]);
    }

    renderer.render(scene, camera);
  }
  frame();
}
