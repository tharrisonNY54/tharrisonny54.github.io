/** Small DOM helpers shared by the sign-up sheet pages. */

export type Tone = 'info' | 'error' | 'success';

/**
 * Looks up a required element and fails loudly if the markup and the script
 * have drifted apart, rather than throwing an opaque null error later.
 */
export function need<T extends Element>(selector: string, root: ParentNode = document): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}

export function showNotice(element: HTMLElement, message: string, tone: Tone = 'info'): void {
  element.textContent = message;
  element.dataset.tone = tone;
  element.hidden = false;
}

export function hideNotice(element: HTMLElement): void {
  element.hidden = true;
  element.textContent = '';
}

export function setText(element: Element, value: string): void {
  element.textContent = value;
}

/** Builds an element without ever assigning a string to innerHTML. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: {
    className?: string;
    text?: string;
    attrs?: Record<string, string>;
    dataset?: Record<string, string>;
  } = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  for (const [name, value] of Object.entries(options.attrs ?? {})) node.setAttribute(name, value);
  for (const [name, value] of Object.entries(options.dataset ?? {})) node.dataset[name] = value;
  return node;
}

export function describeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}
