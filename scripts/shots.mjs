/**
 * Local screenshot harness (dev tool, not shipped).
 * Usage: node scripts/shots.mjs [outDir] [width height]
 */
import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const OUT = resolve(process.argv[2] ?? 'shots');
const W = Number(process.argv[3] ?? 1440);
const H = Number(process.argv[4] ?? 900);
const BASE = 'http://localhost:5173';

const PAGES = [
  { name: 'home-hero', url: '/', wait: 3800 },
  { name: 'home-scroll', url: '/', wait: 3800, scroll: 1.2 },
  { name: 'home-about', url: '/', wait: 3800, scroll: 2.4 },
  { name: 'work-top', url: '/work.html', wait: 1500 },
  { name: 'work-sat', url: '/work.html', wait: 2500, scrollTo: '.sat-stage' },
  { name: 'work-cdh', url: '/work.html', wait: 1500, scrollTo: '#cdh' },
  { name: 'projects', url: '/projects.html', wait: 1500 },
  { name: 'projects-mid', url: '/projects.html', wait: 1500, scroll: 1.0 },
  { name: 'contact', url: '/contact.html', wait: 1500 },
];

await mkdir(OUT, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--hide-scrollbars', '--force-device-scale-factor=1', '--use-angle=default'],
});

const page = await browser.newPage();
await page.setViewport({ width: W, height: H });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

for (const p of PAGES) {
  await page.goto(BASE + p.url, { waitUntil: 'networkidle0' });
  if (p.scrollTo) {
    await page.evaluate((sel) => {
      document.querySelector(sel)?.scrollIntoView({ block: 'center', behavior: 'instant' });
    }, p.scrollTo);
  } else if (p.scroll) {
    await page.evaluate((mult) => window.scrollTo(0, window.innerHeight * mult), p.scroll);
  }
  await new Promise((r) => setTimeout(r, p.wait));
  await page.screenshot({ path: `${OUT}/${p.name}.png` });
  console.log('shot', p.name);
}

if (errors.length) {
  console.log('--- PAGE ERRORS ---');
  errors.forEach((e) => console.log(e));
} else {
  console.log('no page errors');
}
await browser.close();
