/**
 * Shared header/footer markup, injected at module-eval time so the four
 * static pages never drift out of sync. Placeholders in each page:
 *   <div data-header></div> ... <div data-footer></div>
 */

export function mountChrome(): void {
  const headerSlot = document.querySelector('[data-header]');
  const footerSlot = document.querySelector('[data-footer]');

  /*
   * The header carries the wordmark and nothing else.
   *
   * The row of page links that used to sit here is gone: the home page is
   * navigated by scrolling, and each act carries the button for the place it
   * describes. The wordmark stays because a way back to the index from the
   * deeper pages is not optional, and the footer still lists every
   * destination in full.
   */
  if (headerSlot) {
    headerSlot.outerHTML = `
      <header class="site-header at-top">
        <div class="site-header__inner">
          <a class="wordmark" href="/">
            <span class="wordmark__full">TREY HARRISON</span>
            <span class="wordmark__short" aria-hidden="true">TH</span>
          </a>
        </div>
      </header>`;
  }

  if (footerSlot) {
    footerSlot.outerHTML = `
      <footer class="site-footer">
        <div class="wrap">
          <div class="site-footer__grid">
            <p class="site-footer__cta">Working on something interesting?<br /><a href="mailto:treyh413@outlook.com">Email me.</a></p>
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
            <span class="mono mono--micro">Built with Three.js</span>
          </div>
        </div>
      </footer>
      <div class="curtain" aria-hidden="true"></div>`;
  }
}
