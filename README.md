# tharrisonny54.github.io

Personal portfolio — [tharrisonny54.github.io](https://tharrisonny54.github.io/)

Vite + React + TypeScript + Tailwind CSS + Framer Motion.

## Local development

```bash
npm install
npm run dev
```

Opens at http://localhost:5173.

## Build

```bash
npm run build
```

Output goes to `dist/`. Preview locally with `npm run preview`.

## Deploy

Push to `main`. GitHub Actions builds the site and deploys to the `gh-pages` branch automatically.

**First-time setup:** In the repo's **Settings → Pages**, set the source to "Deploy from a branch" and select `gh-pages` / `(root)`. The workflow uses `peaceiris/actions-gh-pages` — no extra secrets needed beyond the default `GITHUB_TOKEN`.

## How to add a project

Open `src/components/Work.tsx`. Find the `FEATURED_PROJECTS` array and append an entry:

```ts
{
  title: 'Project Name',
  description: 'One or two sentences.',
  tags: ['Tag1', 'Tag2'],
  // Optional — omit if no live link:
  link: {
    label: 'View live',
    href: 'https://example.com',
  },
  // Optional — omit if no award:
  award: 'Award Name',
},
```

Remove one of the `// TODO` comment lines to mark the slot used.

## How to add writing posts

Writing is stubbed in `src/components/Writing.tsx`. To wire it up:

1. Create `src/data/posts.ts`:

```ts
export interface Post {
  slug: string
  title: string
  date: string   // ISO 8601
  excerpt: string
}

export const posts: Post[] = [
  {
    slug: 'first-post',
    title: 'Title',
    date: '2025-06-01',
    excerpt: 'One sentence.',
  },
]
```

2. In `Writing.tsx`, import `posts` and replace the "coming soon" paragraph with a mapped list of post cards.

3. For full post pages, create `.tsx` files in `src/posts/` and add routes via `react-router-dom`.

## File structure

```
src/
  components/
    Nav.tsx       — sticky header, theme toggle, mobile menu
    Hero.tsx      — full-viewport intro with name and tagline
    About.tsx     — bio paragraphs + sidebar facts
    Work.tsx      — featured projects (edit FEATURED_PROJECTS here)
    Writing.tsx   — stub section for future posts
    Contact.tsx   — email, GitHub, LinkedIn links
    Footer.tsx    — minimal footer
  hooks/
    useTheme.ts   — dark/light toggle with localStorage
  App.tsx
  index.css       — Tailwind + CSS custom properties for the color system
public/
  favicon.svg
  robots.txt
  sitemap.xml
.github/workflows/deploy.yml
```
