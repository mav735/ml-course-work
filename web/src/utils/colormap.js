const INFERNO_KEYS = [
  [0.00, [0, 0, 4]],
  [0.13, [40, 11, 84]],
  [0.25, [101, 21, 110]],
  [0.38, [159, 42, 99]],
  [0.50, [212, 72, 66]],
  [0.63, [245, 125, 21]],
  [0.75, [250, 193, 39]],
  [0.88, [252, 240, 128]],
  [1.00, [252, 255, 164]],
];

/**
 * Map a normalized value t in [0,1] to inferno RGB.
 */
export function infernoRGB(t) {
  t = Math.max(0, Math.min(1, t));
  let lo = INFERNO_KEYS[0];
  let hi = INFERNO_KEYS[INFERNO_KEYS.length - 1];
  for (let i = 0; i < INFERNO_KEYS.length - 1; i++) {
    if (t >= INFERNO_KEYS[i][0] && t <= INFERNO_KEYS[i + 1][0]) {
      lo = INFERNO_KEYS[i];
      hi = INFERNO_KEYS[i + 1];
      break;
    }
  }

  const span = hi[0] - lo[0];
  const alpha = span === 0 ? 0 : (t - lo[0]) / span;
  return [
    Math.round(lo[1][0] + alpha * (hi[1][0] - lo[1][0])),
    Math.round(lo[1][1] + alpha * (hi[1][1] - lo[1][1])),
    Math.round(lo[1][2] + alpha * (hi[1][2] - lo[1][2])),
  ];
}

/**
 * Map a normalized value t in [0,1] to jet colormap RGB.
 */
export function jetRGB(t) {
  t = Math.max(0, Math.min(1, t));
  const r = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * t - 3)));
  const g = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * t - 2)));
  const b = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * t - 1)));
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Render a Float32Array map of shape [H, W] to a canvas element using the inferno colormap.
 */
export function renderMapToCanvas(canvas, mapData, H, W) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(W, H);
  const d = imgData.data;

  for (let i = 0; i < H * W; i++) {
    const [r, g, b] = infernoRGB(mapData[i]);
    d[i * 4 + 0] = r;
    d[i * 4 + 1] = g;
    d[i * 4 + 2] = b;
    d[i * 4 + 3] = 255;
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Render a grayscale Float32Array map [H, W] to canvas.
 */
export function renderGrayscaleToCanvas(canvas, mapData, H, W) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(W, H);
  const d = imgData.data;

  for (let i = 0; i < H * W; i++) {
    const v = Math.round(mapData[i] * 255);
    d[i * 4 + 0] = v;
    d[i * 4 + 1] = v;
    d[i * 4 + 2] = v;
    d[i * 4 + 3] = 255;
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Normalize a Float32Array to [0, 1].
 */
export function normalizeMap(data) {
  let min = Infinity;
  let max = -Infinity;
  for (const v of data) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min + 1e-8;
  const out = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = (data[i] - min) / range;
  }
  return out;
}

/**
 * Bilinear resize of a Float32Array from [srcH, srcW] to [dstH, dstW].
 */
export function bilinearResize(src, srcH, srcW, dstH, dstW) {
  const dst = new Float32Array(dstH * dstW);
  const scaleY = srcH / dstH;
  const scaleX = srcW / dstW;

  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const srcY = y * scaleY;
      const srcX = x * scaleX;
      const y0 = Math.floor(srcY);
      const x0 = Math.floor(srcX);
      const y1 = Math.min(y0 + 1, srcH - 1);
      const x1 = Math.min(x0 + 1, srcW - 1);
      const fy = srcY - y0;
      const fx = srcX - x0;

      const v00 = src[y0 * srcW + x0];
      const v01 = src[y0 * srcW + x1];
      const v10 = src[y1 * srcW + x0];
      const v11 = src[y1 * srcW + x1];

      dst[y * dstW + x] =
        v00 * (1 - fy) * (1 - fx) +
        v01 * (1 - fy) * fx +
        v10 * fy * (1 - fx) +
        v11 * fy * fx;
    }
  }
  return dst;
}
