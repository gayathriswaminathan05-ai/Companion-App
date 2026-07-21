/** Pixel-perfect hit test for character sprites (object-fit: contain, bottom-center). */

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
let cachedSrc = "";
let cachedOk = false;

function ensureFrame(img: HTMLImageElement): boolean {
  if (!ctx || !img.naturalWidth) return false;
  if (cachedSrc === img.currentSrc || cachedSrc === img.src) return cachedOk;
  cachedSrc = img.currentSrc || img.src;
  try {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    cachedOk = true;
  } catch {
    // Cross-origin / not yet decoded
    cachedOk = false;
  }
  return cachedOk;
}

function opaqueInImage(img: HTMLImageElement, clientX: number, clientY: number): boolean {
  const rect = img.getBoundingClientRect();
  if (clientX < rect.left || clientX >= rect.right || clientY < rect.top || clientY >= rect.bottom) {
    return false;
  }
  if (!ensureFrame(img)) return false;

  const rw = rect.width;
  const rh = rect.height;
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  // Match SpriteAnim: object-fit contain + object-position bottom center
  const scale = Math.min(rw / nw, rh / nh);
  const dispW = nw * scale;
  const dispH = nh * scale;
  const offX = (rw - dispW) / 2;
  const offY = rh - dispH;
  const lx = clientX - rect.left - offX;
  const ly = clientY - rect.top - offY;
  if (lx < 0 || ly < 0 || lx >= dispW || ly >= dispH) return false;

  const px = Math.min(nw - 1, Math.max(0, Math.floor((lx / dispW) * nw)));
  const py = Math.min(nh - 1, Math.max(0, Math.floor((ly / dispH) * nh)));
  const a = ctx!.getImageData(px, py, 1, 1).data[3];
  return a > 20;
}

/** True when the cursor is over a non-transparent character pixel. */
export function isOpaqueCharacterAt(clientX: number, clientY: number): boolean {
  const imgs = document.querySelectorAll<HTMLImageElement>("img[data-char-sprite]");
  for (const img of imgs) {
    if (opaqueInImage(img, clientX, clientY)) return true;
  }
  return false;
}

/** True when over interactive UI (panels, menu, bubbles, growth strip, …). */
export function isUiHitAt(clientX: number, clientY: number): boolean {
  // Geometry check (not elementFromPoint) — works even when ancestors use
  // pointer-events:none and when Electron is forwarding moves.
  const nodes = document.querySelectorAll("[data-hit]");
  for (const node of nodes) {
    const r = (node as HTMLElement).getBoundingClientRect();
    if (clientX >= r.left && clientX < r.right && clientY >= r.top && clientY < r.bottom) {
      return true;
    }
  }
  return false;
}
