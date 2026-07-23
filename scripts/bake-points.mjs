/**
 * bake-points.mjs
 *
 * Local-only build step. Reads the volumetric-capture GLB (a source asset that
 * is git-ignored and never shipped to the client), samples an even, colored
 * point cloud from its surface, normalizes it, and writes a compact binary that
 * IS committed and served. This keeps the 3.4 MB mesh out of the browser bundle.
 *
 * Output format (public/data/points.bin), little-endian:
 *   magic   : 4 bytes  "PTS1"
 *   count   : uint32   number of points
 *   yaw     : float32  suggested initial yaw so the subject faces the camera
 *   height  : float32  normalized model height (world units)
 *   positions: float32 * count * 3   (centered, scaled to height ~2)
 *   colors   : uint8   * count * 3   (sRGB, gamma-encoded)
 *
 * Run:  npm run bake
 */
import { NodeIO } from '@gltf-transform/core';
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'assets/mesh.glb');
const OUT = resolve(ROOT, 'public/data/points.bin');

// How many points to sample. Displacement runs on the GPU, so we can afford a
// dense cloud while keeping the committed binary small (~15 bytes/point).
const TARGET_POINTS = 90_000;

function log(...a) {
  console.log('[bake]', ...a);
}

/** Decode the primitive's base-color texture to a raw RGBA pixel buffer. */
async function decodeTexture(material) {
  const tex = material?.getBaseColorTexture?.();
  if (!tex) return null;
  const image = tex.getImage();
  if (!image) return null;
  const { data, info } = await sharp(Buffer.from(image))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  log(`texture ${info.width}x${info.height}`);
  return { data, width: info.width, height: info.height };
}

function sampleTexel(tex, u, v) {
  // glTF UV origin is top-left; wrap into [0,1).
  u = u - Math.floor(u);
  v = v - Math.floor(v);
  const x = Math.min(tex.width - 1, Math.max(0, Math.floor(u * tex.width)));
  const y = Math.min(tex.height - 1, Math.max(0, Math.floor(v * tex.height)));
  const i = (y * tex.width + x) * 4;
  return [tex.data[i], tex.data[i + 1], tex.data[i + 2]];
}

async function main() {
  log('reading', SRC);
  const io = new NodeIO();
  const doc = await io.read(SRC);
  const meshes = doc.getRoot().listMeshes();

  // Gather every triangle across all primitives with per-vertex position,
  // optional UV, and optional vertex color.
  const tris = [];
  let totalArea = 0;

  for (const mesh of meshes) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const uv = prim.getAttribute('TEXCOORD_0');
      const col = prim.getAttribute('COLOR_0');
      const idxAcc = prim.getIndices();
      const tex = await decodeTexture(prim.getMaterial());

      const vCount = pos.getCount();
      const indices = idxAcc
        ? idxAcc.getArray()
        : Uint32Array.from({ length: vCount }, (_, i) => i);

      const p = [0, 0, 0];
      const q = [0, 0, 0];
      const r = [0, 0, 0];
      for (let t = 0; t < indices.length; t += 3) {
        const a = indices[t], b = indices[t + 1], c = indices[t + 2];
        pos.getElement(a, p); pos.getElement(b, q); pos.getElement(c, r);
        // Triangle area via cross product.
        const ab = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
        const ac = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
        const cx = ab[1] * ac[2] - ab[2] * ac[1];
        const cy = ab[2] * ac[0] - ab[0] * ac[2];
        const cz = ab[0] * ac[1] - ab[1] * ac[0];
        const area = 0.5 * Math.hypot(cx, cy, cz);
        if (area <= 0) continue;
        totalArea += area;
        tris.push({ a, b, c, area, pos, uv, col, tex });
      }
    }
  }

  log(`${tris.length} triangles, total surface area ${totalArea.toFixed(3)}`);
  if (!tris.length) throw new Error('no triangles found in GLB');

  // Allocate. Sample count per triangle proportional to its area.
  const positions = new Float32Array(TARGET_POINTS * 3);
  const colors = new Uint8Array(TARGET_POINTS * 3);
  let n = 0;

  const pa = [0, 0, 0], pb = [0, 0, 0], pc = [0, 0, 0];
  const ua = [0, 0], ub = [0, 0], uc = [0, 0];
  const ca = [0, 0, 0, 1], cb = [0, 0, 0, 1], cc = [0, 0, 0, 1];

  // Running bounds for normalization.
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (const tri of tris) {
    if (n >= TARGET_POINTS) break;
    let k = (tri.area / totalArea) * TARGET_POINTS;
    let count = Math.floor(k);
    if (Math.random() < k - count) count++;
    if (count <= 0) continue;

    tri.pos.getElement(tri.a, pa);
    tri.pos.getElement(tri.b, pb);
    tri.pos.getElement(tri.c, pc);
    if (tri.uv) {
      tri.uv.getElement(tri.a, ua);
      tri.uv.getElement(tri.b, ub);
      tri.uv.getElement(tri.c, uc);
    }
    if (tri.col) {
      tri.col.getElement(tri.a, ca);
      tri.col.getElement(tri.b, cb);
      tri.col.getElement(tri.c, cc);
    }

    for (let s = 0; s < count && n < TARGET_POINTS; s++) {
      // Uniform barycentric sample.
      let b1 = Math.random(), b2 = Math.random();
      if (b1 + b2 > 1) { b1 = 1 - b1; b2 = 1 - b2; }
      const b0 = 1 - b1 - b2;

      const x = pa[0] * b0 + pb[0] * b1 + pc[0] * b2;
      const y = pa[1] * b0 + pb[1] * b1 + pc[1] * b2;
      const z = pa[2] * b0 + pb[2] * b1 + pc[2] * b2;
      positions[n * 3] = x;
      positions[n * 3 + 1] = y;
      positions[n * 3 + 2] = z;
      if (x < min[0]) min[0] = x; if (x > max[0]) max[0] = x;
      if (y < min[1]) min[1] = y; if (y > max[1]) max[1] = y;
      if (z < min[2]) min[2] = z; if (z > max[2]) max[2] = z;

      let cr = 200, cg = 200, cb_ = 200;
      if (tri.tex && tri.uv) {
        const u = ua[0] * b0 + ub[0] * b1 + uc[0] * b2;
        const v = ua[1] * b0 + ub[1] * b1 + uc[1] * b2;
        [cr, cg, cb_] = sampleTexel(tri.tex, u, v);
      } else if (tri.col) {
        cr = Math.round((ca[0] * b0 + cb[0] * b1 + cc[0] * b2) * 255);
        cg = Math.round((ca[1] * b0 + cb[1] * b1 + cc[1] * b2) * 255);
        cb_ = Math.round((ca[2] * b0 + cb[2] * b1 + cc[2] * b2) * 255);
      }
      colors[n * 3] = cr;
      colors[n * 3 + 1] = cg;
      colors[n * 3 + 2] = cb_;
      n++;
    }
  }

  log(`sampled ${n} points`);

  // Cull capture-rig artifacts: drop points farther than CULL_RADIUS from the
  // body's median axis in the ground plane, then recompute bounds.
  const CULL_RADIUS = 0.45;
  const median = (arr) => {
    const s = Float32Array.from(arr).sort();
    return s[s.length >> 1];
  };
  const xs = new Float32Array(n);
  const zs = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    xs[i] = positions[i * 3];
    zs[i] = positions[i * 3 + 2];
  }
  const cx = median(xs);
  const cz = median(zs);
  let kept = 0;
  min[0] = min[1] = min[2] = Infinity;
  max[0] = max[1] = max[2] = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    if (Math.hypot(x - cx, z - cz) > CULL_RADIUS) continue;
    positions[kept * 3] = x;
    positions[kept * 3 + 1] = y;
    positions[kept * 3 + 2] = z;
    colors[kept * 3] = colors[i * 3];
    colors[kept * 3 + 1] = colors[i * 3 + 1];
    colors[kept * 3 + 2] = colors[i * 3 + 2];
    if (x < min[0]) min[0] = x; if (x > max[0]) max[0] = x;
    if (y < min[1]) min[1] = y; if (y > max[1]) max[1] = y;
    if (z < min[2]) min[2] = z; if (z > max[2]) max[2] = z;
    kept++;
  }
  log(`culled ${n - kept} outlier points (radius ${CULL_RADIUS})`);
  n = kept;

  // Normalize: center on X/Z and on vertical midpoint, scale to height ~2.
  const center = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ];
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const height = size[1] || 1;
  const scale = 2 / height;
  for (let i = 0; i < n; i++) {
    positions[i * 3] = (positions[i * 3] - center[0]) * scale;
    positions[i * 3 + 1] = (positions[i * 3 + 1] - center[1]) * scale;
    positions[i * 3 + 2] = (positions[i * 3 + 2] - center[2]) * scale;
  }
  log(`bounds size ${size.map((v) => v.toFixed(2)).join(' x ')}, scaled x${scale.toFixed(3)}`);

  // Assemble binary.
  const header = new ArrayBuffer(16);
  const hv = new DataView(header);
  hv.setUint8(0, 0x50); hv.setUint8(1, 0x54); hv.setUint8(2, 0x53); hv.setUint8(3, 0x31); // "PTS1"
  hv.setUint32(4, n, true);
  hv.setFloat32(8, 0, true);          // yaw (tuned client-side if needed)
  hv.setFloat32(12, 2.0, true);       // normalized height
  const posBytes = Buffer.from(positions.buffer, 0, n * 3 * 4);
  const colBytes = Buffer.from(colors.buffer, 0, n * 3);
  const out = Buffer.concat([Buffer.from(header), posBytes, colBytes]);

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, out);
  log(`wrote ${OUT} (${(out.length / 1024).toFixed(0)} KB, ${n} points)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
