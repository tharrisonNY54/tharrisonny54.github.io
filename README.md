# treyharrison — portfolio

Personal portfolio for Trey Harrison, deployed to GitHub Pages from `main`.

The hero is a volumetric capture rendered as a ~90k-point cloud in a custom
Three.js shader — it self-assembles on load and reacts to the cursor. The
Aspera satellite on the Work page is generated procedurally in the browser.

## Stack

- Vite (multi-page: `index` / `work` / `projects` / `contact`)
- Three.js + hand-written GLSL, TypeScript, hand-written CSS
- Self-hosted fonts via Fontsource (Space Grotesk / Instrument Serif / Space Mono)

## Commands

| Command         | What it does                                                     |
| --------------- | ---------------------------------------------------------------- |
| `npm run dev`   | Dev server at `localhost:5173`                                    |
| `npm run build` | Static build to `dist/` (what CI deploys)                         |
| `npm run bake`  | Re-sample `assets/mesh.glb` → `public/data/points.bin` (local)    |

## Asset pipeline

`assets/` holds source material (volumetric mesh, reference media) and is
git-ignored — it never ships. `scripts/bake-points.mjs` samples the mesh
surface into a compact binary (`public/data/points.bin`, ~1.3 MB) that IS
committed and served. Re-run `npm run bake` only when the scan changes.

`scripts/shots.mjs` is a local screenshot harness (needs Chrome + dev server).

## Deploy

Push to `main` → `.github/workflows/deploy.yml` runs `npm ci && npm run build`
and publishes `dist/` to GitHub Pages.
