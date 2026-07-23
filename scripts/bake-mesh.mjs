/**
 * bake-mesh.mjs
 *
 * Local-only build step. Compresses the volumetric-capture GLB (git-ignored
 * source) into a web-ready GLB that IS committed and served:
 *   - welds duplicate vertices
 *   - quantizes attributes (KHR_mesh_quantization — natively supported by three)
 *   - re-encodes the base-color texture as WebP
 *
 * Run:  npm run bake:mesh
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, quantize, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';
import { stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'assets/mesh.glb');
const OUT = resolve(ROOT, 'public/data/scan.glb');

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(SRC);

/**
 * The capture rig leaves stray geometry (wand/tripod slivers) floating away
 * from the subject. Drop any triangle whose centroid sits farther than
 * `radius` from the body's median axis in the ground plane.
 */
function cullOutliers(radius = 0.45) {
  const median = (arr) => {
    const s = Float32Array.from(arr).sort();
    return s[s.length >> 1];
  };
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const idx = prim.getIndices();
      if (!pos || !idx) continue;
      const n = pos.getCount();
      const xs = new Float32Array(n);
      const zs = new Float32Array(n);
      const v = [0, 0, 0];
      for (let i = 0; i < n; i++) {
        pos.getElement(i, v);
        xs[i] = v[0];
        zs[i] = v[2];
      }
      const cx = median(xs);
      const cz = median(zs);
      const arr = idx.getArray();
      const keep = [];
      const pa = [0, 0, 0], pb = [0, 0, 0], pc = [0, 0, 0];
      for (let t = 0; t < arr.length; t += 3) {
        pos.getElement(arr[t], pa);
        pos.getElement(arr[t + 1], pb);
        pos.getElement(arr[t + 2], pc);
        const mx = (pa[0] + pb[0] + pc[0]) / 3 - cx;
        const mz = (pa[2] + pb[2] + pc[2]) / 3 - cz;
        if (Math.hypot(mx, mz) <= radius) keep.push(arr[t], arr[t + 1], arr[t + 2]);
      }
      const removed = (arr.length - keep.length) / 3;
      idx.setArray(arr instanceof Uint16Array ? new Uint16Array(keep) : new Uint32Array(keep));
      console.log(`[bake:mesh] culled ${removed} outlier triangles (radius ${radius})`);
    }
  }
}
cullOutliers();

await doc.transform(
  weld(),
  quantize(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 82 }),
);

await io.write(OUT, doc);
const { size } = await stat(OUT);
console.log(`[bake:mesh] wrote ${OUT} (${(size / 1024).toFixed(0)} KB)`);
