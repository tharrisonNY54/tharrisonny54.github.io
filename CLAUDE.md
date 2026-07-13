# CLAUDE.md — treyharrison.dev

This file is the project constitution. Every session must enforce it. It is derived verbatim
from the owner's kickoff brief. When a request conflicts with this file, this file wins — unless
the owner explicitly overrides it in the current session.

---

## 0. Context

- Owner: Trey Harrison — CS + Math + AI student, University of Arizona. Software developer on the
  NASA ASPERA satellite mission (SPICE geometry/ephemeris tooling). Volumetric capture developer at
  the UA Center for Digital Humanities.
- Primary audience: NASA JPL/Goddard mission-software reviewers evaluating internship candidates.
  Secondary: NVIDIA/graphics recruiters. The site is a credibility signal, not a marketing page.
- Launch target: September 1, 2026, alongside the open-source release of Tessel.
- Voice: plain, factual, specific. No buzzwords ("passionate", "leverage", "cutting-edge" are
  banned). Claims must be verifiable; numbers must be real.

---

## 1. Design constitution

Direction: **mission telemetry**. The site should look like ground-segment software built by someone
who works on spacecraft — quiet, dense, monospace-forward, data-first. It must never look like a
template, a crypto dashboard, or sci-fi UI.

### Palette (dark only — no light theme, no toggle)
- `--bg: #0a0a0a` page background
- `--surface: #111111` raised panels (rare)
- `--border: #262626` primary rules; `#1a1a1a` for table row rules
- `--text: #fafafa` primary; `--text-2: #a3a3a3` secondary; `--text-3: #525252` muted
- `--accent: #22d3ee` cyan — reserved for live/active values, links, focus rings, and the scan line.
  Never used decoratively, never as a background fill larger than a badge.
- No other hues. No gradients of any kind. No purple anywhere.

### Typography
- Data/labels/nav/tables/metadata: **IBM Plex Mono** (via `next/font`), 11–13px, uppercase
  micro-labels with `letter-spacing: 0.08em`.
- Headings and prose: **Public Sans** (the US Web Design System face — deliberate choice for this
  audience), weights 400/500 only.
- Do not use Geist, Inter, Space Grotesk, or any font that ships as a framework default.

### Texture and layout
- Hairline rules (1px), full-bleed horizontal dividers, tabular data, real coordinates and
  timestamps. Grid-aligned, generous line-height in prose, dense in tables.
- The signature element is the point-cloud hero. It is the one bold thing on the site. Everything
  else stays quiet and disciplined.
- Telemetry flourishes must be real data: live UTC clock in the footer, `32.23N 110.95W · TUCSON`,
  actual vertex count from the loaded buffer, measured FPS (rolling average, rounded). Never render
  fake numbers.

### Banned (hard rules — reject any suggestion that violates them)
- Gradients, glow, bloom, neon, drop shadows, blur, noise/grain overlays
- Scanline/CRT effects, chromatic aberration, RGB split, glitch or scramble text, typewriter
  effects, matrix rain
- Particle trails, additive blending, lens flares
- Emoji in UI, stock icons doing decoration, skill-percentage bars, testimonial carousels
- Fast or looping motion. All animation is slow, damped, and runs once or on explicit interaction.
  `prefers-reduced-motion` is fully respected everywhere.

---

## 2. Stack and engineering standards

- Next.js 15, App Router, TypeScript strict (no `any`). Tailwind CSS v4 with the palette above as
  CSS variables/theme tokens.
- three.js + @react-three/fiber + @react-three/drei for the hero only. Everything else is server
  components; client islands only where interaction requires it.
- Content: MDX files in `/content` (case studies, writing) compiled at build time. No CMS, no
  database.
- Dev machine is Windows/PowerShell — all build/preprocessing scripts must be cross-platform Node
  (`.mjs`), never bash.
- Deploy: Vercel. Include `next/og` per-page OG images in the telemetry style (dark, mono,
  project ID + title).
- Accessibility: semantic HTML, visible cyan focus rings, keyboard navigable, contrast AA minimum
  (verify `#a3a3a3` on `#0a0a0a` for its sizes).
- SEO: metadata API, sitemap, robots, RSS for /writing, JSON-LD Person schema.
- Performance budget: Lighthouse ≥ 95 all categories; LCP < 2.0s (the hero canvas must not be the
  LCP — header and headline text render immediately); hero JS chunk lazy-loaded.
- Dependencies are locked to: next, react, three, @react-three/fiber, @react-three/drei,
  @gltf-transform/core (dev), tailwindcss, MDX tooling. **Ask before adding anything else.**

### Repository conventions
- App code lives at the repo root (no `src/`): `app/`, `components/`, `lib/`, `content/`,
  `scripts/`. Path alias `@/*` maps to the repo root.
- The self-scan model (`assets/mesh.glb`) never ships to the client. `assets/` is gitignored.
  The runtime hero consumes only the preprocessed `public/pointcloud.bin`.

---

## 3. Rules of engagement

1. One phase per session. State what you're building, build it, verify it in the browser, then stop.
2. Never invent facts, metrics, dates, or copy beyond what the brief provides. Use `TODO(trey):`
   markers and list them at the end of each session.
3. Any visual idea must pass the Banned list before you write it. When in doubt, leave it out —
   restraint is the aesthetic.
4. Ask before adding dependencies, changing the palette, or deviating from the hero spec.
5. All numbers rendered on screen must be real or omitted.

---

## 4. Phases

- **Phase 0 — scaffold.** Next.js 15 (TS, App Router, Tailwind v4), fonts, design tokens,
  header/footer with live UTC clock, empty routes, `CLAUDE.md`. AC: deploys clean, dark-only, no
  CLS, Lighthouse ≥ 95.
- **Phase 1 — point cloud.** `scripts/sample-pointcloud.mjs` + `public/pointcloud.bin` + hero
  component, all fallbacks, static PNG fallback asset. AC: 60fps desktop, reduced-motion path,
  mobile path, zero layout shift, scan runs once and on click.
- **Phase 2 — home.** Full home page with real copy, manifest table, experience, secondary
  projects, contact. AC: responsive to 360px, keyboard navigable, no placeholder text except
  `TODO(trey)` markers.
- **Phase 3 — case studies.** MDX pipeline, template, four studies. AC: builds statically, per-page
  metadata + OG images, TODO list surfaced.
- **Phase 4 — writing + polish.** Writing section, RSS, sitemap, JSON-LD, OG images for all routes,
  final perf and a11y pass. AC: Lighthouse ≥ 95 all pages, axe clean, budget met.
