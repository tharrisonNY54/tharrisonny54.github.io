/**
 * Shared header/footer markup, injected at module-eval time so the four
 * static pages never drift out of sync. Placeholders in each page:
 *   <div data-header></div> ... <div data-footer></div>
 */

const NAV = [
  { href: '/work.html', label: 'Work', index: '01' },
  { href: '/projects.html', label: 'Projects', index: '02' },
  { href: '/contact.html', label: 'Contact', index: '03' },
];

export function mountChrome(): void {
  const headerSlot = document.querySelector('[data-header]');
  const footerSlot = document.querySelector('[data-footer]');
  const path = location.pathname.replace(/\/$/, '/index.html');

  if (headerSlot) {
    const links = NAV.map((n) => {
      const current = path.endsWith(n.href) ? ' aria-current="page"' : '';
      return `<a href="${n.href}"${current}><span class="nav__index">${n.index}&nbsp;</span>${n.label}</a>`;
    }).join('');
    headerSlot.outerHTML = `
      <header class="site-header">
        <div class="site-header__inner">
          <a class="wordmark" href="/">TREY HARRISON<sup>TUS</sup></a>
          <nav class="nav" aria-label="Main navigation">${links}</nav>
        </div>
      </header>`;
  }

  if (footerSlot) {
    footerSlot.outerHTML = `
      <footer class="site-footer">
        <div class="wrap">
          <div class="site-footer__grid">
            <p class="site-footer__cta">Working on something interesting?<br /><a href="mailto:treyh413@outlook.com">Write to me.</a></p>
            <div class="footcol">
              <h4>Navigate</h4>
              <ul>
                <li><a href="/">Index</a></li>
                <li><a href="/work.html">Work</a></li>
                <li><a href="/projects.html">Projects</a></li>
                <li><a href="/contact.html">Contact</a></li>
              </ul>
            </div>
            <div class="footcol">
              <h4>Elsewhere</h4>
              <ul>
                <li><a href="https://github.com/tharrisonNY54" target="_blank" rel="noopener">GitHub</a></li>
                <li><a href="https://www.linkedin.com/in/trey-harrison/" target="_blank" rel="noopener">LinkedIn</a></li>
                <li><a href="/resume.pdf" target="_blank" rel="noopener">Resume</a></li>
              </ul>
            </div>
          </div>
          <div class="site-footer__base">
            <span class="mono mono--micro">&copy; <span data-year></span> Trey Harrison &mdash; Tucson, AZ</span>
            <span class="mono mono--micro">Built with Three.js &middot; No templates</span>
            <span class="mono mono--micro" data-clock></span>
          </div>
        </div>
      </footer>
      <div class="curtain" aria-hidden="true"></div>`;
  }
}
