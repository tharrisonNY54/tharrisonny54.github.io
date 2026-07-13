// Offline preprocessing: sample a dense, uniform point cloud from the photogrammetry
// scan and emit a compact quantized binary the hero fetches at runtime. The source
// mesh (assets/mesh.glb) never ships to the client.
//
//   node scripts/sample-pointcloud.mjs
//
// Output:
//   public/pointcloud.bin           header "PC01" + uint32 count + Int16 xyz triplets
//   public/pointcloud-fallback.png  static render for the no-WebGL fallback
//
// Cross-platform Node (Windows/PowerShell friendly). No bash, no native deps.

import { NodeIO } from "@gltf-transform/core";
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INPUT = resolve(ROOT, "assets/mesh.glb");
const OUT_BIN = resolve(ROOT, "public/pointcloud.bin");
const OUT_PNG = resolve(ROOT, "public/pointcloud-fallback.png");

const SAMPLE_COUNT = 48_000;
const QUANT = 32767; // Int16 range for normalized [-0.5, 0.5] axes
const PNG_SIZE = 900;

// --- tiny column-major mat4 helpers (glTF convention) --------------------------

function composeTRS(t, q, s) {
  const [x, y, z, w] = q;
  const [sx, sy, sz] = s;
  const xx = x * x, xy = x * y, xz = x * z, xw = x * w;
  const yy = y * y, yz = y * z, yw = y * w;
  const zz = z * z, zw = z * w;
  return [
    (1 - 2 * (yy + zz)) * sx, 2 * (xy + zw) * sx, 2 * (xz - yw) * sx, 0,
    2 * (xy - zw) * sy, (1 - 2 * (xx + zz)) * sy, 2 * (yz + xw) * sy, 0,
    2 * (xz + yw) * sz, 2 * (yz - xw) * sz, (1 - 2 * (xx + yy)) * sz, 0,
    t[0], t[1], t[2], 1,
  ];
}

function multiply(a, b) {
  const out = new Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[r] * b[c * 4] +
        a[4 + r] * b[c * 4 + 1] +
        a[8 + r] * b[c * 4 + 2] +
        a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

function transformPoint(m, px, py, pz) {
  const x = m[0] * px + m[4] * py + m[8] * pz + m[12];
  const y = m[1] * px + m[5] * py + m[9] * pz + m[13];
  const z = m[2] * px + m[6] * py + m[10] * pz + m[14];
  const w = m[3] * px + m[7] * py + m[11] * pz + m[15];
  const iw = w !== 0 ? 1 / w : 1;
  return [x * iw, y * iw, z * iw];
}

const localMatrix = (node) =>
  composeTRS(node.getTranslation(), node.getRotation(), node.getScale());

// --- collect world-space triangles ---------------------------------------------

function collectTriangles(doc) {
  const positions = []; // flat [ax,ay,az, bx,by,bz, cx,cy,cz, ...]
  const root = doc.getRoot();
  const scenes = root.listScenes();
  const roots = scenes.length
    ? scenes.flatMap((s) => s.listChildren())
    : root.listNodes();

  const walk = (node, parentWorld) => {
    const world = multiply(parentWorld, localMatrix(node));
    const mesh = node.getMesh();
    if (mesh) {
      for (const prim of mesh.listPrimitives()) {
        if (prim.getMode() !== 4) continue; // TRIANGLES only
        const posAcc = prim.getAttribute("POSITION");
        if (!posAcc) continue;
        const raw = posAcc.getArray();
        const count = posAcc.getCount();

        // Pre-transform every vertex once, then index into it.
        const wp = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          const [wx, wy, wz] = transformPoint(
            world,
            raw[i * 3],
            raw[i * 3 + 1],
            raw[i * 3 + 2],
          );
          wp[i * 3] = wx;
          wp[i * 3 + 1] = wy;
          wp[i * 3 + 2] = wz;
        }

        const idxAcc = prim.getIndices();
        const idx = idxAcc ? idxAcc.getArray() : null;
        const triCount = idx ? idx.length / 3 : count / 3;
        for (let t = 0; t < triCount; t++) {
          const a = idx ? idx[t * 3] : t * 3;
          const b = idx ? idx[t * 3 + 1] : t * 3 + 1;
          const c = idx ? idx[t * 3 + 2] : t * 3 + 2;
          positions.push(
            wp[a * 3], wp[a * 3 + 1], wp[a * 3 + 2],
            wp[b * 3], wp[b * 3 + 1], wp[b * 3 + 2],
            wp[c * 3], wp[c * 3 + 1], wp[c * 3 + 2],
          );
        }
      }
    }
    for (const child of node.listChildren()) walk(child, world);
  };

  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const node of roots) walk(node, identity);
  return new Float32Array(positions);
}

// --- area-weighted uniform surface sampling ------------------------------------

function sampleSurface(tris, n) {
  const triCount = tris.length / 9;
  const cumulative = new Float64Array(triCount);
  let total = 0;
  for (let t = 0; t < triCount; t++) {
    const o = t * 9;
    const e1x = tris[o + 3] - tris[o], e1y = tris[o + 4] - tris[o + 1], e1z = tris[o + 5] - tris[o + 2];
    const e2x = tris[o + 6] - tris[o], e2y = tris[o + 7] - tris[o + 1], e2z = tris[o + 8] - tris[o + 2];
    const cx = e1y * e2z - e1z * e2y;
    const cy = e1z * e2x - e1x * e2z;
    const cz = e1x * e2y - e1y * e2x;
    total += 0.5 * Math.hypot(cx, cy, cz);
    cumulative[t] = total;
  }

  const pickTriangle = (r) => {
    let lo = 0, hi = triCount - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = pickTriangle(Math.random() * total);
    const o = t * 9;
    // Uniform barycentric coordinates.
    let u = Math.random();
    let v = Math.random();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const w = 1 - u - v;
    out[i * 3] = w * tris[o] + u * tris[o + 3] + v * tris[o + 6];
    out[i * 3 + 1] = w * tris[o + 1] + u * tris[o + 4] + v * tris[o + 7];
    out[i * 3 + 2] = w * tris[o + 2] + u * tris[o + 5] + v * tris[o + 8];
  }
  return out;
}

// --- normalize: center at origin, unit height (Y in [-0.5, 0.5]) ----------------

function normalize(points) {
  const n = points.length / 3;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = points[i * 3], y = points[i * 3 + 1], z = points[i * 3 + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
  const height = maxY - minY;
  const scale = height > 0 ? 1 / height : 1;
  for (let i = 0; i < n; i++) {
    points[i * 3] = (points[i * 3] - cx) * scale;
    points[i * 3 + 1] = (points[i * 3 + 1] - cy) * scale;
    points[i * 3 + 2] = (points[i * 3 + 2] - cz) * scale;
  }
  return {
    min: [(minX - cx) * scale, (minY - cy) * scale, (minZ - cz) * scale],
    max: [(maxX - cx) * scale, (maxY - cy) * scale, (maxZ - cz) * scale],
  };
}

// --- write quantized binary -----------------------------------------------------

function writeBin(points) {
  const n = points.length / 3;
  const buf = Buffer.alloc(8 + n * 3 * 2);
  buf.write("PC01", 0, "ascii");
  buf.writeUInt32LE(n, 4);
  let clamped = 0;
  for (let i = 0; i < n * 3; i++) {
    let q = Math.round((points[i] / 0.5) * QUANT); // normalized: value / 0.5 * 32767
    if (q > QUANT) { q = QUANT; clamped++; }
    else if (q < -QUANT) { q = -QUANT; clamped++; }
    buf.writeInt16LE(q, 8 + i * 2);
  }
  writeFileSync(OUT_BIN, buf);
  return { bytes: buf.length, clamped };
}

// --- PNG fallback (pure Node, colorType 2 / RGB) --------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// Deterministic per-index hash — selects the ~3% cyan subset for the fallback.
const isCyan = (i) => {
  const h = Math.sin(i * 12.9898) * 43758.5453;
  return h - Math.floor(h) < 0.03;
};

function renderPng(points) {
  const S = PNG_SIZE;
  const rgb = Buffer.alloc(S * S * 3);
  for (let p = 0; p < S * S; p++) {
    rgb[p * 3] = 0x0a; rgb[p * 3 + 1] = 0x0a; rgb[p * 3 + 2] = 0x0a; // #0a0a0a
  }

  const ppu = S * 0.9; // height 1.0 fills 90% of the frame
  const cx = S / 2, cy = S / 2;

  const n = points.length / 3;
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => points[a * 3 + 2] - points[b * 3 + 2], // painter's: far (−z) first
  );

  const plot = (px, py, r, g, b) => {
    if (px < 0 || py < 0 || px >= S || py >= S) return;
    const o = (py * S + px) * 3;
    rgb[o] = r; rgb[o + 1] = g; rgb[o + 2] = b;
  };

  for (const i of order) {
    const px = Math.round(cx + points[i * 3] * ppu);
    const py = Math.round(cy - points[i * 3 + 1] * ppu); // y up
    const [r, g, b] = isCyan(i) ? [0x22, 0xd3, 0xee] : [0xe5, 0xe5, 0xe5];
    plot(px, py, r, g, b);
    plot(px + 1, py, r, g, b);
    plot(px, py + 1, r, g, b);
    plot(px + 1, py + 1, r, g, b);
  }

  // Filter type 0 per scanline, then zlib.
  const raw = Buffer.alloc(S * (S * 3 + 1));
  for (let y = 0; y < S; y++) {
    raw[y * (S * 3 + 1)] = 0;
    rgb.copy(raw, y * (S * 3 + 1) + 1, y * S * 3, (y + 1) * S * 3);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0);
  ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  writeFileSync(OUT_PNG, png);
  return png.length;
}

// --- main -----------------------------------------------------------------------

const io = new NodeIO();
const doc = await io.read(INPUT);

const tris = collectTriangles(doc);
if (tris.length === 0) throw new Error("No triangle geometry found in " + INPUT);
console.log(`triangles collected: ${tris.length / 9}`);

const points = sampleSurface(tris, SAMPLE_COUNT);
const bounds = normalize(points);
const bin = writeBin(points);
const pngBytes = renderPng(points);

const fmt = (a) => a.map((v) => v.toFixed(4)).join(", ");
console.log(`sampled points:  ${SAMPLE_COUNT}`);
console.log(`bbox min:        [${fmt(bounds.min)}]`);
console.log(`bbox max:        [${fmt(bounds.max)}]`);
console.log(`pointcloud.bin:  ${(bin.bytes / 1024).toFixed(1)} KB (${bin.clamped} axes clamped)`);
console.log(`fallback.png:    ${(pngBytes / 1024).toFixed(1)} KB (${PNG_SIZE}x${PNG_SIZE})`);
