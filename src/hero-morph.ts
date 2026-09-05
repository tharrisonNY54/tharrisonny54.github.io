import * as THREE from 'three';

/**
 * The home stage: one cloud of points, four forms, driven by scroll.
 *
 * The cloud opens as Trey's own volumetric capture, sectioned into contour
 * bands, and then stops being him — it reforms into a banded sphere, into a
 * data surface, and finally lets go. Nothing is added or removed between
 * forms, so every transition reads as the same material rearranging itself:
 *
 *   0  SECTIONS  the capture, cropped to head and shoulders, cut into bands
 *   1  SPHERE    a lat/long shell with two inclined rings
 *   2  SURFACE   a swept grid, the shape of a signal rather than an object
 *   3  RELEASE   the points let go along the silhouette they started from
 *
 * The captured RGB is never read. It is in the file, and it is deliberately
 * skipped: this is an abstraction of a scan, not a rendering of one. Colour
 * comes from depth and motion only.
 *
 * Forms 1 and 2 are generated here from arithmetic. No form depends on
 * client-owned material or on mission imagery, which is a hard constraint on
 * this site rather than a stylistic preference.
 */

const POINTS_URL = '/data/points.bin';

/**
 * The head-and-shoulders crop holds 17,206 unique points, so this sits just
 * above it: duplication lands near 1.05x rather than the 2.5x a tighter crop
 * would force, and duplicates are jittered (see buildFigure) so the extra
 * points add density instead of stacking on the same pixels.
 */
const POINT_COUNT = 18_000;

const FORM_COUNT = 4;

/* Camera is fixed; forms are baked to fit the frame and the cloud is moved in
   world space instead. Vertical FOV 28deg at z=2.2 frames ~1.10 units. */
const FOV = 28;
const CAM_Z = 2.2;

/*
 * Portrait crop, in capture space (the capture spans y = -1 to 1).
 *
 * y > 0.45 is head, shoulders and upper chest: 17,206 points across a band
 * 0.60 wide and 0.55 tall. Cropping here rather than at the chest concentrates
 * every available point into the part actually on screen.
 */
const PORTRAIT_FLOOR = 0.45;
const PORTRAIT_PIVOT_Y = 0.72;
const PORTRAIT_SCALE = 1.6;

/*
 * Dissolve band, in capture space. The capture continues below the chest, but
 * showing where the crop stops looks like a mistake, so the figure fades out
 * into the well instead of ending on a hard edge.
 */
const PORTRAIT_FADE_START_SRC = 0.58;
const PORTRAIT_FADE_END_SRC = 0.47;
const PORTRAIT_FADE_START = (PORTRAIT_FADE_START_SRC - PORTRAIT_PIVOT_Y) * PORTRAIT_SCALE;
const PORTRAIT_FADE_END = (PORTRAIT_FADE_END_SRC - PORTRAIT_PIVOT_Y) * PORTRAIT_SCALE;

/**
 * Horizontal position of the cloud per act, in world units.
 *
 * Half-frame width at this camera is ~0.93, so ±0.26 sets the cloud clearly to
 * one side while leaving its full width on screen. The copy column takes the
 * opposite side (.panel:nth-child in plates.css) and the two have to stay in
 * step: act 1 copy sits left, so the cloud sits right.
 */
const ACT_X = [0.26, -0.26, 0.26, 0.0];

/**
 * Depth-ramp window per form, as [near, span] offsets from the camera.
 * The ramp tracks how deep each form actually is: the sectioned figure is only
 * ~0.35 units front-to-back, while the released cloud is over 1.2. One shared
 * window would flatten the figure or clip the release.
 */
const DEPTH_WINDOWS: Array<[number, number]> = [
  [CAM_Z - 0.26, 0.52], // sections
  [CAM_Z - 0.44, 0.88], // sphere
  [CAM_Z - 0.4, 0.8], // surface
  [CAM_Z - 0.55, 1.1], // release
];

/* ------------------------------------------------------------------ *
 * Form builders. Each returns exactly POINT_COUNT * 3 floats.
 * ------------------------------------------------------------------ */

/**
 * The capture itself, cropped to head and shoulders.
 *
 * Not a form in its own right any more — it is the raw material the opening
 * sections form and the closing release are both derived from.
 */
function buildFigure(src: Float32Array): Float32Array {
  const keep: number[] = [];
  for (let i = 0; i < src.length; i += 3) {
    if (src[i + 1] > PORTRAIT_FLOOR) keep.push(i);
  }

  /* Fisher-Yates over the kept indices, so the thinning is uniform. Taking
     every Nth point instead would sample the capture's scan order and leave
     visible banding. */
  for (let i = keep.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [keep[i], keep[j]] = [keep[j], keep[i]];
  }

  const out = new Float32Array(POINT_COUNT * 3);
  for (let n = 0; n < POINT_COUNT; n++) {
    const s = keep[n % keep.length];
    /* Points past the first pass over `keep` are repeats. Nudging them off the
       original by a hair under the local point spacing makes them read as
       additional surface samples rather than as overdraw. */
    const dup = n >= keep.length ? 0.004 : 0;
    out[n * 3] = (src[s] + (Math.random() - 0.5) * dup) * PORTRAIT_SCALE;
    out[n * 3 + 1] =
      (src[s + 1] + (Math.random() - 0.5) * dup - PORTRAIT_PIVOT_Y) * PORTRAIT_SCALE;
    out[n * 3 + 2] = (src[s + 2] + (Math.random() - 0.5) * dup) * PORTRAIT_SCALE;
  }
  return out;
}

/**
 * The opening form: the same body, snapped into horizontal contour bands.
 *
 * Quantising only Y leaves X and Z untouched, so each band keeps the true
 * cross-section of the head or shoulder it came from. It reads as a sectioned
 * scan of a person rather than as stripes laid over one.
 *
 * The count is set by the face, not by how the banding looks on the shoulders:
 * much below 50 and the head loses its features and collapses into a dome.
 */
const SLICE_COUNT = 54;

function buildSections(figure: Float32Array): Float32Array {
  const out = new Float32Array(POINT_COUNT * 3);

  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < figure.length; i += 3) {
    if (figure[i] < minY) minY = figure[i];
    if (figure[i] > maxY) maxY = figure[i];
  }
  const step = (maxY - minY) / SLICE_COUNT;

  for (let i = 0; i < figure.length; i += 3) {
    const band = Math.round((figure[i + 1] - minY) / step);
    out[i] = figure[i];
    /* A touch of thickness per band, so a slice reads as a ribbon with
       substance rather than as an infinitely thin line. */
    out[i + 1] = minY + band * step + (Math.random() - 0.5) * step * 0.16;
    out[i + 2] = figure[i + 2];
  }
  return out;
}

/**
 * A banded shell with two inclined rings.
 *
 * Deliberately not a spacecraft. An earlier pass built an actual smallsat here
 * — bus, solar wings, instrument tube — and it read as overclaiming. A sphere
 * with orbits around it is geometry, which is the honest version of what the
 * work actually is.
 *
 * Points are biased onto latitude and longitude lines because a uniform shell
 * sample at this density just fills in as a flat disc.
 */
/* The outer ring reaches 1.42x this, and the form sits 0.26 off-centre, so the
   shell has to stay well inside the ~0.88 half-frame or the ring clips. */
const SPHERE_R = 0.34;
const SPHERE_LATS = 22;
const SPHERE_LONGS = 32;

/**
 * Tucson, 32.2226 N 110.9747 W, marked on the shell.
 *
 * The longitude is not the real one. The globe carries no coastlines — there
 * is no landmass data here and none that could be invented honestly — so a
 * true longitude would put the pin at an arbitrary-looking spot on a bare
 * sphere. It is placed to face the camera instead, which is the only reading
 * that makes the marker legible. The latitude is real, so the pin sits at the
 * correct height on the globe.
 */
const PIN_LAT = (32.2226 * Math.PI) / 180;
const PIN_LON = -Math.PI / 2 + 0.3;

/** Share of the cloud spent drawing the marker rather than the shell. */
const PIN_FRACTION = 0.04;

/** Unit normal at the pin, and the head of its spike, in sphere-local space. */
function pinBasis(): { n: [number, number, number]; t1: [number, number, number]; t2: [number, number, number] } {
  const cu = Math.cos(PIN_LAT);
  const n: [number, number, number] = [
    Math.cos(PIN_LON) * cu,
    Math.sin(PIN_LAT),
    Math.sin(PIN_LON) * cu,
  ];
  /* Any two vectors perpendicular to the normal will do for the base ring;
     crossing with world up is stable everywhere except the poles, and the pin
     is at 32 degrees. */
  const ux = n[1] * 0 - n[2] * 1;
  const uy = n[2] * 0 - n[0] * 0;
  const uz = n[0] * 1 - n[1] * 0;
  const ul = Math.hypot(ux, uy, uz) || 1;
  const t1: [number, number, number] = [ux / ul, uy / ul, uz / ul];
  const t2: [number, number, number] = [
    n[1] * t1[2] - n[2] * t1[1],
    n[2] * t1[0] - n[0] * t1[2],
    n[0] * t1[1] - n[1] * t1[0],
  ];
  return { n, t1, t2 };
}

/** Height of the spike above the shell, as a multiple of the radius. */
const PIN_RISE = 0.42;

/**
 * @param pinOut per-point 0/1 flag, filled in for the marker's points so the
 *   shader can light them differently from the shell.
 */
function buildSphere(pinOut: Float32Array): Float32Array {
  const out = new Float32Array(POINT_COUNT * 3);
  const pinCount = Math.round(POINT_COUNT * PIN_FRACTION);
  const shellCount = POINT_COUNT - pinCount;
  const { n, t1, t2 } = pinBasis();

  /* The marker: a ring on the surface, a spike standing off it, and a head at
     the top. Built from the tail of the buffer so the shell loop below is
     unaffected by how many points the pin takes. */
  for (let m = 0; m < pinCount; m++) {
    const i = (shellCount + m) * 3;
    pinOut[shellCount + m] = 1;
    const r = Math.random();

    if (r < 0.42) {
      // Base ring, lying on the shell.
      const a = Math.random() * Math.PI * 2;
      const ang = 0.13 + (Math.random() - 0.5) * 0.012;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const dx = t1[0] * Math.cos(a) + t2[0] * Math.sin(a);
      const dy = t1[1] * Math.cos(a) + t2[1] * Math.sin(a);
      const dz = t1[2] * Math.cos(a) + t2[2] * Math.sin(a);
      out[i] = (n[0] * ca + dx * sa) * SPHERE_R;
      out[i + 1] = (n[1] * ca + dy * sa) * SPHERE_R;
      out[i + 2] = (n[2] * ca + dz * sa) * SPHERE_R;
    } else if (r < 0.84) {
      // Spike, tapering as it rises.
      const t = Math.random();
      const h = SPHERE_R * (1 + t * PIN_RISE);
      const j = 0.006 * (1 - t);
      out[i] = n[0] * h + (Math.random() - 0.5) * j;
      out[i + 1] = n[1] * h + (Math.random() - 0.5) * j;
      out[i + 2] = n[2] * h + (Math.random() - 0.5) * j;
    } else {
      // Head.
      const h = SPHERE_R * (1 + PIN_RISE);
      out[i] = n[0] * h + (Math.random() - 0.5) * 0.022;
      out[i + 1] = n[1] * h + (Math.random() - 0.5) * 0.022;
      out[i + 2] = n[2] * h + (Math.random() - 0.5) * 0.022;
    }
  }

  for (let n2 = 0; n2 < shellCount; n2++) {
    const i = n2 * 3;
    const r = Math.random();

    if (r < 0.78) {
      /* Shell. Snapping one of the two angles onto the grid draws the
         wireframe; leaving the other free spreads points along that line. */
      let u = Math.random() * 2 - 1; // cos(polar), for even area
      let lon = Math.random() * Math.PI * 2;
      if (Math.random() < 0.5) {
        u = (Math.round(((u + 1) / 2) * SPHERE_LATS) / SPHERE_LATS) * 2 - 1;
      } else {
        lon = (Math.round((lon / (Math.PI * 2)) * SPHERE_LONGS) / SPHERE_LONGS) * Math.PI * 2;
      }
      const s = Math.sqrt(Math.max(0, 1 - u * u));
      out[i] = Math.cos(lon) * s * SPHERE_R;
      out[i + 1] = u * SPHERE_R;
      out[i + 2] = Math.sin(lon) * s * SPHERE_R;
    } else {
      /* Two inclined rings, standing off the shell. */
      const ring = Math.random() < 0.5 ? 0 : 1;
      const tilt = ring === 0 ? 0.42 : -0.66;
      const rad = SPHERE_R * (ring === 0 ? 1.42 : 1.24);
      const a = Math.random() * Math.PI * 2;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      const thin = (Math.random() - 0.5) * 0.012;
      out[i] = x;
      out[i + 1] = z * Math.sin(tilt) + thin;
      out[i + 2] = z * Math.cos(tilt);
    }
  }
  return out;
}

/**
 * A swept grid: the shape of a signal, not of an object.
 *
 * Rows and columns are drawn rather than filled — at this point count a solid
 * surface reads as noise, where a ruled one reads as a surface. Tilted away
 * from the camera so the height actually shows.
 */
const SURFACE_COLS = 46;
const SURFACE_ROWS = 30;

function buildSurface(): Float32Array {
  const out = new Float32Array(POINT_COUNT * 3);
  /* Tilting swings the near edge toward the camera, where perspective widens
     it by about 12%. The nominal width has to leave room for that on top of
     the 0.26 offset, or the grid runs off the frame. */
  const W = 0.84;
  const D = 0.66;
  const TILT = 0.92; // radians, front edge dropped toward the viewer

  for (let n = 0; n < POINT_COUNT; n++) {
    const i = n * 3;
    let u = Math.random() - 0.5;
    let v = Math.random() - 0.5;
    /* Snap one axis so the grid lines read; leave the other continuous. */
    if (Math.random() < 0.5) u = Math.round(u * SURFACE_COLS) / SURFACE_COLS;
    else v = Math.round(v * SURFACE_ROWS) / SURFACE_ROWS;

    const x = u * W;
    const z = v * D;
    /* Two out-of-phase waves, so the surface has structure without looking
       like a single textbook sine. */
    const h =
      Math.sin(u * 9.1) * 0.055 + Math.cos(v * 7.3 + u * 3.1) * 0.045 + Math.sin(u * 21.0) * 0.012;

    const ct = Math.cos(TILT);
    const st = Math.sin(TILT);
    out[i] = x;
    out[i + 1] = h * ct - z * st;
    out[i + 2] = h * st + z * ct;
  }
  return out;
}

/**
 * Release: the figure letting go along its own silhouette.
 *
 * Each point travels outward on its own vector, so the expanding cloud still
 * carries the shape it came from. Pushing everything onto a generic sphere
 * instead threw that away and produced a ball of dots. The push is kept short
 * for the same reason: spread wide it stops being a figure that let go and
 * becomes a starfield behind the copy.
 */
function buildRelease(figure: Float32Array): Float32Array {
  const out = new Float32Array(POINT_COUNT * 3);
  for (let i = 0; i < figure.length; i += 3) {
    const x = figure[i];
    const y = figure[i + 1];
    const z = figure[i + 2];
    const len = Math.hypot(x, y, z) || 1e-5;
    const push = 0.1 + Math.random() * 0.26;
    out[i] = x + (x / len) * push;
    out[i + 1] = y + (y / len) * push * 0.8;
    out[i + 2] = z + (z / len) * push;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Shaders
 * ------------------------------------------------------------------ */

const vertexShader = /* glsl */ `
  uniform float uSize;
  uniform float uDpr;
  uniform vec4  uFormA;     // one-hot: the form being left
  uniform vec4  uFormB;     // one-hot: the form being entered
  uniform float uMix;       // 0-1 across the pair
  uniform float uTime;
  uniform float uBreathe;
  uniform float uSettle;    // 0 = dispersed on first load, 1 = arrived
  uniform vec3  uRippleO;   // where the last press landed, in local space
  uniform float uRippleR;   // how far the front has travelled since
  uniform float uRippleAmp; // fades to 0 as the wave dies out

  attribute vec3 aP1;
  attribute vec3 aP2;
  attribute vec3 aP3;
  attribute float aPin;

  varying float vDepth;
  varying float vEnergy;
  varying float vFade;
  varying float vY;
  varying float vPin;

  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  }

  void main() {
    /* One-hot dot products rather than an indexed lookup: GLSL ES 1.0 cannot
       index an attribute array dynamically, and this resolves the pair to two
       real positions the point can be interpolated between. */
    vec3 A = position * uFormA.x + aP1 * uFormA.y + aP2 * uFormA.z + aP3 * uFormA.w;
    vec3 B = position * uFormB.x + aP1 * uFormB.y + aP2 * uFormB.z + aP3 * uFormB.w;

    float h = hash(position);

    /*
     * Per-point stagger. Every point runs the same transition on its own
     * clock, so the cloud comes apart and rebuilds in waves instead of sliding
     * across as one rigid object.
     */
    /* Enough lag between points that the cloud comes apart in waves, but not
       so much that the midpoint is a superposition of the whole transition —
       at 0.4 every intermediate state was on screen at once and the form
       dissolved into featureless noise. */
    /* This controls how wave-like the morph is, not how long it takes — the
       pacing comes from the scroll length and the dwell window. Pushed high it
       just smears every intermediate state together into noise. */
    const float SPREAD = 0.22;
    float ft = clamp((uMix - h * SPREAD) / (1.0 - SPREAD), 0.0, 1.0);
    ft = ft * ft * (3.0 - 2.0 * ft);

    vec3 pos = mix(A, B, ft);

    /* A stable per-point direction, reused by the reform below and by the
       first-load assembly further down. */
    vec3 dir = normalize(vec3(
      hash(position + 1.7) - 0.5,
      hash(position + 3.1) - 0.5,
      hash(position + 5.3) - 0.5
    ) + 1e-5);

    /*
     * The reform. Peaks halfway through and returns to nothing at both ends,
     * so each form is still reached exactly.
     *
     * The twist is sheared by distance from the axis — points near the centre
     * barely turn, points at the rim sweep right around — which draws the
     * cloud into a spiral on the way through. The scatter rides along each
     * point's own direction rather than radially outward from the origin: a
     * radial push turns every form into the same sphere at the midpoint, so
     * all three transitions looked identical.
     */
    float mid = sin(ft * 3.14159265);
    float rad = length(pos.xy);
    float ang = mid * (1.15 - min(rad, 1.0)) * 2.1;
    float ca = cos(ang);
    float sa = sin(ang);
    pos.xy = vec2(pos.x * ca - pos.y * sa, pos.x * sa + pos.y * ca);
    /* Small. The spiral is what should carry the transition; scatter past
       about this much stops reading as structure coming apart and starts
       reading as noise laid over the top of it. */
    pos += dir * mid * (0.004 + h * 0.022);

    /* First-load assembly, staggered per point. */
    float delay = h * 0.45;
    float t = clamp((uSettle - delay) / (1.0 - delay), 0.0, 1.0);
    float settle = 1.0 - pow(1.0 - t, 3.0);
    pos += dir * (1.0 - settle) * (0.55 + h * 0.75);

    pos += dir * sin(uTime * 0.6 + h * 6.283) * 0.0035 * uBreathe;

    /*
     * Press ripple. A single shell expanding from wherever the last click or
     * tap landed, displacing and lighting each point as the front passes
     * through it and leaving it where it found it.
     *
     * This replaces a wake that tracked the cursor continuously. That version
     * meant the cloud was permanently deformed around the pointer and there
     * was no way to look at an undisturbed form; a wave that arrives, passes
     * and dies gives the interaction a beginning and an end.
     */
    vec3 toR = pos - uRippleO;
    float rd = length(toR);
    float push = exp(-pow((rd - uRippleR) * 9.0, 2.0)) * uRippleAmp;
    pos += normalize(toR + 1e-4) * push * 0.1;

    vY = pos.y;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    vDepth = -mv.z;

    /* Dissolve at the crop line. Driven by the point's place in the sectioned
       figure (the position attribute) and applied only in proportion to how
       much of that form is showing, so the other three stay whole. */
    float pf = smoothstep(${PORTRAIT_FADE_END.toFixed(3)}, ${PORTRAIT_FADE_START.toFixed(3)}, position.y);
    float show0 = uFormA.x * (1.0 - ft) + uFormB.x * ft;
    vFade = mix(1.0, pf, show0) * settle;

    /* The marker only exists on the globe, so it lights up in proportion to
       how much of that form is currently showing and vanishes with it. */
    float show1 = uFormA.y * (1.0 - ft) + uFormB.y * ft;
    vPin = aPin * show1 * settle;

    /* Points in flight brighten, so a transition looks like energy rather than
       a crossfade. The ripple front feeds the same channel. */
    vEnergy = clamp(length(B - A) * mid * 1.1 + push * 1.8, 0.0, 1.0) * settle;

    float size = uSize * uDpr / max(-mv.z, 0.001);
    gl_PointSize = clamp(size * (1.0 + push * 0.8 + vPin * 0.55), 1.0, 6.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform float uGain;
  uniform float uDepthNear;
  uniform float uDepthSpan;
  uniform float uTime;
  uniform float uScan;      // 0 disables the projection artefacts entirely
  varying float vDepth;
  varying float vEnergy;
  varying float vFade;
  varying float vY;
  varying float vPin;

  /*
   * A three-stop depth ramp is what sells this as volumetric light rather than
   * as blue dots: the far side falls into indigo instead of simply darkening,
   * so near structure separates from far structure.
   */
  const vec3 FAR  = vec3(0.130, 0.120, 0.380);
  const vec3 MID  = vec3(0.330, 0.870, 0.960);
  const vec3 NEAR = vec3(0.930, 1.000, 1.000);

  /* The one warm note in the whole scene. Everything else on this page is on
     the cyan/indigo axis, so the marker reads as "here" instantly without
     needing to be bigger or brighter than the geometry around it. */
  const vec3 PIN  = vec3(1.000, 0.660, 0.280);

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dd = dot(uv, uv);
    if (dd > 0.25) discard;
    float alpha = smoothstep(0.25, 0.06, dd) * vFade;
    if (alpha < 0.01) discard;

    float d = clamp((vDepth - uDepthNear) / uDepthSpan, 0.0, 1.0);
    vec3 col = d < 0.5 ? mix(NEAR, MID, d * 2.0) : mix(MID, FAR, (d - 0.5) * 2.0);

    /* Fine interference lines, plus one slow bright sweep travelling up. Both
       are keyed to world height rather than to screen space, so they sit on
       the form and travel with it instead of behaving like a viewport filter. */
    float lines = 0.5 + 0.5 * sin(vY * 210.0 - uTime * 1.6);
    float sweep = exp(-pow((vY - (fract(uTime * 0.09) * 2.2 - 1.1)) * 6.0, 2.0));
    col *= mix(1.0, 0.82 + lines * 0.36, uScan);
    col = mix(col, NEAR, sweep * 0.5 * uScan);

    col = mix(col, NEAR, vEnergy * 0.5);

    /* The marker overrides the depth ramp rather than tinting it: half-mixed
       with the shell colour behind it, amber on cyan just goes grey. */
    col = mix(col, PIN, vPin);

    /* Far points are held back so near structure still separates, but not so
       hard that the far side drops out and the form reads as a silhouette. */
    alpha *= mix(1.0, 0.52, d);
    alpha *= mix(1.0, 0.9 + lines * 0.2, uScan);
    /* Marker points ignore the depth dimming, so the pin stays solid even when
       it swings toward the back of the globe. */
    alpha = mix(alpha, max(alpha, smoothstep(0.25, 0.06, dd) * vFade * 0.85), vPin);

    /*
     * Premultiplied additive. Points are drawn in buffer order with no depth
     * sort, so any order-dependent blend lets far points paint over near ones
     * and the form collapses into a flat shadow. Adding is order-independent,
     * and the accumulation along silhouette edges is what gives the cloud its
     * glow.
     */
    gl_FragColor = vec4(col * alpha * uGain, alpha);
  }
`;

/* ------------------------------------------------------------------ *
 * Runtime
 * ------------------------------------------------------------------ */

async function loadCapture(): Promise<Float32Array> {
  const res = await fetch(POINTS_URL);
  if (!res.ok) throw new Error(`points ${res.status}`);
  const buf = await res.arrayBuffer();
  const view = new DataView(buf);
  const magic = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3),
  );
  if (magic !== 'PTS1') throw new Error('bad points header');
  const count = view.getUint32(4, true);
  /* Positions only. The captured RGB sits right after this block and is never
     read: this is an abstraction of the capture, not a rendering of it. */
  return new Float32Array(buf, 16, count * 3);
}

/**
 * Dwell either side of each transition, as a fraction of one act's scroll.
 *
 * Some hold is needed, or the cloud is always partway between two shapes and
 * never actually *is* either of them. But hold is expensive: whatever it takes
 * is taken from the morph, which then has to cover the same ground in less
 * scroll and speeds up. An earlier pass at 0.34/0.14 left the morph only half
 * the act and made the transformation snappier, not slower.
 *
 * These are deliberately small. The form still settles at each end, and the
 * transformation itself gets the large majority of the scroll.
 */
const HOLD_IN = 0.13;
const HOLD_OUT = 0.07;

/**
 * Where scroll progress sits between the forms.
 *
 * `f` is the raw position across the act; `mix` is that shaped by the dwell
 * window and a smootherstep. Everything driven by the transition — the point
 * blend, the depth window, the horizontal travel — reads `mix`, so the whole
 * composition holds and moves as one rather than drifting out of step.
 */
function actAt(progress: number): { index: number; mix: number } {
  const m = progress * (FORM_COUNT - 1);
  const index = Math.min(Math.floor(m), FORM_COUNT - 2);
  const f = m - index;

  const t = Math.min(Math.max((f - HOLD_IN) / (1 - HOLD_IN - HOLD_OUT), 0), 1);
  /* Plain smoothstep, not smootherstep. Smootherstep's flatter ends have to be
     paid for in the middle, where it runs correspondingly faster — the whole
     point here is that no part of the transformation is hurried. */
  return { index, mix: t * t * (3 - 2 * t) };
}

async function start(mount: HTMLElement, section: HTMLElement): Promise<void> {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return; // No WebGL: the copy and the CSS ground still carry the section.
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAM_Z);

  const group = new THREE.Group();
  group.rotation.y = Math.PI; // capture faces -Z in source coordinates
  scene.add(group);

  let capture: Float32Array;
  try {
    capture = await loadCapture();
  } catch (err) {
    console.error('[stage]', err);
    renderer.dispose();
    return;
  }

  /* The figure is the raw material for the first and last forms, so it is
     built once, used, and never drawn directly. */
  const figure = buildFigure(capture);

  /* Marks the points that draw the Tucson pin. Zero everywhere else, so the
     flag costs nothing in the three forms that have no marker. */
  const pinFlags = new Float32Array(POINT_COUNT);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(buildSections(figure), 3));
  geo.setAttribute('aP1', new THREE.BufferAttribute(buildSphere(pinFlags), 3));
  geo.setAttribute('aP2', new THREE.BufferAttribute(buildSurface(), 3));
  geo.setAttribute('aP3', new THREE.BufferAttribute(buildRelease(figure), 3));
  geo.setAttribute('aPin', new THREE.BufferAttribute(pinFlags, 1));
  geo.computeBoundingSphere();

  const uniforms = {
    uSize: { value: 3.2 },
    uDpr: { value: dpr },
    uFormA: { value: new THREE.Vector4(1, 0, 0, 0) },
    uFormB: { value: new THREE.Vector4(0, 1, 0, 0) },
    uMix: { value: 0 },
    uTime: { value: 0 },
    uBreathe: { value: reduced ? 0 : 1 },
    uSettle: { value: reduced ? 1 : 0 },
    uRippleO: { value: new THREE.Vector3(0, 0, 0) },
    uRippleR: { value: 0 },
    uRippleAmp: { value: 0 },
    /* Additive accumulation lands near 0.3 for a single layer, so the gain has
       to lift lit surfaces into a readable range without clipping the mass. */
    uGain: { value: 2.15 },
    uDepthNear: { value: DEPTH_WINDOWS[0][0] },
    uDepthSpan: { value: DEPTH_WINDOWS[0][1] },
    /* The scanlines are a motion effect; with reduced motion the cloud keeps
       its depth colour but stops flickering and sweeping. */
    uScan: { value: reduced ? 0 : 1 },
  };

  const points = new THREE.Points(
    geo,
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor, // colour is premultiplied in the shader
      blendDst: THREE.OneFactor,
      blendEquation: THREE.AddEquation,
    }),
  );
  group.add(points);

  /*
   * Below the breakpoint where the copy moves off to one side, the cloud has
   * to stay centred — there is no free column to slide into.
   */
  const wide = window.matchMedia('(min-width: 901px)');

  const resize = (): void => {
    const w = mount.clientWidth || 1;
    const h = mount.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  /* Declared before the input handlers, which read it to timestamp a press. */
  const clock = new THREE.Clock();

  /* A slow turn toward the cursor. The cloud never spins by itself. */
  let targetYaw = 0;
  let targetPitch = 0;
  let yaw = 0;
  let pitch = 0;

  /*
   * Press ripple. Fires on click or tap anywhere over the stage, expands
   * through the cloud and dies. Only one is ever in flight — pressing again
   * restarts it, which keeps repeated clicking responsive instead of letting
   * overlapping waves cancel each other into noise.
   */
  const RIPPLE_SPEED = 0.62; // world units per second
  const RIPPLE_LIFE = 1.5; // seconds
  let rippleStart = -1;

  if (!reduced) {
    window.addEventListener(
      'pointermove',
      (e) => {
        targetYaw = ((e.clientX / window.innerWidth) * 2 - 1) * 0.17;
        targetPitch = ((e.clientY / window.innerHeight) * 2 - 1) * 0.08;
      },
      { passive: true },
    );

    section.addEventListener(
      'pointerdown',
      (e) => {
        /* Project the press onto the plane the cloud sits in, then into the
           group's own space so the wave stays anchored to the cloud as it
           turns and travels rather than to a fixed point on screen. */
        const nx = (e.clientX / window.innerWidth) * 2 - 1;
        const ny = -((e.clientY / window.innerHeight) * 2 - 1);
        const halfH = Math.tan((FOV * Math.PI) / 360) * CAM_Z;
        const p = new THREE.Vector3(nx * halfH * camera.aspect, ny * halfH, 0);
        group.worldToLocal(p);
        uniforms.uRippleO.value.copy(p);
        rippleStart = clock.getElapsedTime();
      },
      { passive: true },
    );
  }

  /* Scroll progress across the pinned range. Read in the frame loop from a
     cached rect so the scroll listener itself stays free of layout reads. */
  let progress = 0;
  let smoothed = 0;
  const readProgress = (): void => {
    const rect = section.getBoundingClientRect();
    const travel = rect.height - window.innerHeight;
    progress = travel <= 0 ? 0 : Math.min(Math.max(-rect.top / travel, 0), 1);
  };
  readProgress();
  window.addEventListener('scroll', readProgress, { passive: true });
  window.addEventListener('resize', readProgress);

  mount.classList.add('ready');

  /*
   * The reading scrim is one-sided, so it has to follow the copy rather than
   * stay pinned left. The sticky element carries the current side and the
   * gradient direction is chosen in CSS from that.
   */
  const sticky = section.querySelector<HTMLElement>('.stage__sticky');
  let side = '';

  /*
   * The Tucson label. It is an HTML element rather than baked points so it
   * stays crisp type at any zoom, but it is driven entirely from the pin's
   * projected position, so it tracks the marker as the globe turns.
   */
  const pinLabel = section.querySelector<HTMLElement>('[data-stage-pin]');
  const pinBase = pinBasis().n;
  const pinHead = new THREE.Vector3(...pinBase).multiplyScalar(SPHERE_R * (1 + PIN_RISE));
  const pinProjected = new THREE.Vector3();
  let pinShown = -1;

  let inView = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((e) => (inView = e[0].isIntersecting), { threshold: 0 }).observe(section);

    /*
     * While the stage is on screen the header floats over a dark well and has
     * to stay inverted, even once the page has scrolled past the point where it
     * would normally pick up its paper ground.
     */
    new IntersectionObserver(
      (e) => document.body.classList.toggle('over-stage', e[0].isIntersecting),
      { threshold: 0 },
    ).observe(section);
  }

  const t0 = performance.now();

  function frame(): void {
    requestAnimationFrame(frame);
    if (!inView || document.hidden) return;

    uniforms.uTime.value = clock.getElapsedTime();
    if (!reduced) {
      uniforms.uSettle.value = Math.min((performance.now() - t0) / 2600, 1);
    }

    /* Ease toward the scroll target so trackpad jitter does not shear the
       cloud, and so a flung scroll still resolves smoothly. */
    smoothed += (progress - smoothed) * (reduced ? 1 : 0.09);

    const { index, mix } = actAt(smoothed);

    uniforms.uFormA.value.set(0, 0, 0, 0).setComponent(index, 1);
    uniforms.uFormB.value.set(0, 0, 0, 0).setComponent(index + 1, 1);
    uniforms.uMix.value = mix;

    /* The depth window blends with the forms; a single fixed window would
       flatten the sections or clip the release. */
    uniforms.uDepthNear.value =
      DEPTH_WINDOWS[index][0] * (1 - mix) + DEPTH_WINDOWS[index + 1][0] * mix;
    uniforms.uDepthSpan.value =
      DEPTH_WINDOWS[index][1] * (1 - mix) + DEPTH_WINDOWS[index + 1][1] * mix;

    /* The cloud still crosses the frame between acts, so the copy always has
       the half it is not in — the reform above is what makes the crossing
       interesting rather than a slide. Driven by the same shaped mix, so it
       waits through the dwell and travels with the morph. */
    const targetX = wide.matches ? ACT_X[index] * (1 - mix) + ACT_X[index + 1] * mix : 0;
    group.position.x += (targetX - group.position.x) * (reduced ? 1 : 0.12);

    if (sticky) {
      /* Threshold rather than sign, so a cloud sitting near centre does not
         flip the scrim back and forth. */
      const next = targetX > 0.06 ? 'right' : targetX < -0.06 ? 'left' : 'centre';
      if (next !== side) {
        side = next;
        sticky.dataset.side = next;
      }
    }

    /* A slight counter-turn as it travels, so the cloud reads as pivoting
       across the frame rather than sliding flat like a decal. */
    yaw += (targetYaw - group.position.x * 0.42 - yaw) * 0.045;
    pitch += (targetPitch - pitch) * 0.045;
    group.rotation.y = Math.PI + yaw;
    group.rotation.x = pitch;

    /*
     * Track the pin with its label. Only the globe carries a marker, so the
     * label's presence is exactly how much of that form is showing.
     */
    if (pinLabel) {
      const showSphere =
        (index === 1 ? 1 - mix : 0) + (index + 1 === 1 ? mix : 0);
      /* Held back until the globe is nearly whole. The label names a point on
         a sphere, so any earlier and it is captioning a cloud that has no pin
         in it yet — which is exactly how it read at a third. */
      const amt = Math.max(0, Math.min(1, (showSphere - 0.78) / 0.18));

      if (amt > 0.001) {
        pinProjected.copy(pinHead).applyMatrix4(group.matrixWorld).project(camera);
        /* project() gives NDC; the mount's box turns that into CSS pixels. */
        const px = (pinProjected.x * 0.5 + 0.5) * mount.clientWidth;
        const py = (-pinProjected.y * 0.5 + 0.5) * mount.clientHeight;
        pinLabel.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;
      }
      /* Writing opacity every frame would dirty style on frames where nothing
         moved, so it only goes out when it actually changes. */
      if (Math.abs(amt - pinShown) > 0.01) {
        pinShown = amt;
        pinLabel.style.opacity = String(amt);
      }
    }

    /* Advance the ripple front and fade it out. Once spent it is switched off
       entirely rather than left at a small amplitude, so idle frames are not
       paying for a wave nobody can see. */
    if (rippleStart >= 0) {
      const age = uniforms.uTime.value - rippleStart;
      if (age >= RIPPLE_LIFE) {
        rippleStart = -1;
        uniforms.uRippleAmp.value = 0;
      } else {
        uniforms.uRippleR.value = age * RIPPLE_SPEED;
        /* Squared falloff: the front stays bright while it is crossing the
           form and then drops away quickly, rather than lingering. */
        const k = 1 - age / RIPPLE_LIFE;
        uniforms.uRippleAmp.value = k * k;
      }
    }

    renderer.render(scene, camera);
  }
  frame();
}

export function initHeroStage(): void {
  const mount = document.querySelector<HTMLElement>('.stage__canvas');
  const section = document.querySelector<HTMLElement>('.stage');
  if (!mount || !section) return;
  void start(mount, section);
}
