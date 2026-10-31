// A small tooltip inside a (possibly scrolling) chart host, for things Tableau's own tooltip can't show.

export function showTip(host: HTMLElement, tip: HTMLElement, html: string, e: PointerEvent): void {
  tip.innerHTML = html;
  tip.hidden = false;
  const b = host.getBoundingClientRect();
  // Position in the host's visible area, then add its scroll offset (the tip lives inside the scrolling content).
  let lx = e.clientX - b.left + 12;
  const ly = e.clientY - b.top + 12;
  if (lx + tip.offsetWidth > b.width) lx = e.clientX - b.left - tip.offsetWidth - 12;
  tip.style.left = `${lx + host.scrollLeft}px`;
  tip.style.top = `${ly + host.scrollTop}px`;
}

export function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
