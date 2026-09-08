/**
 * Edge-safe QR code rendering via `qrcode-generator` (pure JS, no Node APIs).
 * Produces an SVG data URL that <img src> renders directly.
 */
import qrcode from "qrcode-generator";

export function svgDataUrl(text, options = {}) {
  const { size = 256, margin = 2 } = options;
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();

  const count = qr.getModuleCount();
  const scale = Math.floor(size / (count + margin * 2)) || 1;
  const quietZone = margin * scale;
  const dim = count * scale + quietZone * 2;

  let cells = "";
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) {
        cells += `<rect x="${quietZone + col * scale}" y="${quietZone + row * scale}" width="${scale}" height="${scale}"/>`;
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${Math.max(size, dim)}" height="${Math.max(size, dim)}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/>${cells}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}