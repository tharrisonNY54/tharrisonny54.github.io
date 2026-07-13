// Loader + parser for the preprocessed point cloud binary (see
// scripts/sample-pointcloud.mjs for the writer). Format:
//   bytes 0..3   ASCII magic "PC01"
//   bytes 4..7   uint32 LE point count
//   bytes 8..    Int16 LE xyz triplets, normalized so real = q / 32767 * 0.5

const MAGIC = "PC01";

export interface PointCloudData {
  /** Int16 xyz triplets — bound directly as a normalized position attribute. */
  positions: Int16Array;
  count: number;
  /** Per-point deterministic seed in [0, 1) for activation jitter and idle noise. */
  seeds: Float32Array;
  /** Per-point flag: 1 for the ~3% accent (cyan) points, else 0. */
  cyan: Float32Array;
}

/** Deterministic per-index hash in [0, 1). Stable across reloads. */
function hash1(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

export async function loadPointCloud(
  url: string,
  maxPoints?: number,
): Promise<PointCloudData> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`pointcloud fetch failed: ${res.status} ${res.statusText}`);
  }
  const buf = await res.arrayBuffer();
  const view = new DataView(buf);

  const magic = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3),
  );
  if (magic !== MAGIC) {
    throw new Error(`unexpected pointcloud magic "${magic}"`);
  }

  const total = view.getUint32(4, true);
  const count = maxPoints ? Math.min(maxPoints, total) : total;

  // Sampling order is already random, so the first N points are a uniform subset.
  const all = new Int16Array(buf, 8, total * 3);
  const positions = count === total ? all : all.slice(0, count * 3);

  const seeds = new Float32Array(count);
  const cyan = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    seeds[i] = hash1(i + 1);
    cyan[i] = hash1((i + 1) * 1.7 + 3.3) < 0.03 ? 1 : 0;
  }

  return { positions, count, seeds, cyan };
}
