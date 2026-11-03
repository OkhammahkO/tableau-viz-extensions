// A PNG of a chart for Tableau's export (API 1.17: reportExtensionRenderComplete takes an optional image). Composes
// the element's <svg> and <canvas> layers in document order, at their on-screen positions, into one image, so charts
// that draw marks on a canvas export too. Returns null where the browser can't draw (e.g. a test DOM).

export async function snapshotPng(el: HTMLElement, scale = window.devicePixelRatio || 1): Promise<ArrayBuffer | null> {
  const box = el.getBoundingClientRect();
  const width = Math.ceil(Math.max(el.scrollWidth, box.width));
  const height = Math.ceil(Math.max(el.scrollHeight, box.height));
  if (!width || !height) return null;
  const out = document.createElement('canvas');
  out.width = Math.round(width * scale);
  out.height = Math.round(height * scale);
  const ctx = out.getContext?.('2d');
  if (!ctx) return null;
  ctx.scale(scale, scale);
  ctx.fillStyle = getComputedStyle(el).backgroundColor || '#ffffff';
  if (ctx.fillStyle === 'rgba(0, 0, 0, 0)') ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  for (const layer of el.querySelectorAll<SVGSVGElement | HTMLCanvasElement>('svg, canvas')) {
    if (layer.closest('[hidden]') || (layer instanceof SVGSVGElement && layer.ownerSVGElement)) continue; // skip nested svgs
    const r = layer.getBoundingClientRect();
    const x = r.left - box.left + el.scrollLeft;
    const y = r.top - box.top + el.scrollTop;
    if (layer instanceof HTMLCanvasElement) {
      ctx.drawImage(layer, x, y, r.width, r.height);
      continue;
    }
    const clone = layer.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(r.width));
    clone.setAttribute('height', String(r.height));
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      ctx.drawImage(img, x, y, r.width, r.height);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'));
  return blob ? blob.arrayBuffer() : null;
}
