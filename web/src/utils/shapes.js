// Shape model and rasterization helpers.
//
// All shapes live in a 256x256 logical canvas (CANVAS_SIZE) and are stored as
// plain JSON-friendly objects. 
// On save we render onto a 64×64 grayscale canvas to feed the model.

export const CANVAS_SIZE = 256;
export const TARGET_SIZE = 64;

/**
 * Render a single shape onto a 2D canvas context using its (x, y, rotation).
 * `scale` lets us draw the same shapes onto a smaller canvas (e.g. 64×64).
 */
export function drawShape(ctx, shape, scale = 1) {
  const fill = shape.fill ?? '#ffffff';
  const stroke = shape.stroke ?? fill;
  const strokeWidth = (shape.strokeWidth ?? 2) * scale;
  const filled = shape.filled !== false;
  const stroked = shape.stroked === true;
  const isLine = shape.type === 'line';

  ctx.save();
  ctx.translate(shape.x * scale, shape.y * scale);
  ctx.rotate(((shape.rotation ?? 0) * Math.PI) / 180);
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = isLine ? Math.max(1, strokeWidth) : strokeWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  switch (shape.type) {
    case 'rect': {
      const w = shape.width * scale;
      const h = shape.height * scale;
      if (filled) ctx.fillRect(0, 0, w, h);
      if (stroked) ctx.strokeRect(0, 0, w, h);
      break;
    }
    case 'circle': {
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(0.5, shape.radius * scale), 0, Math.PI * 2);
      if (filled) ctx.fill();
      if (stroked) ctx.stroke();
      break;
    }
    case 'ellipse': {
      ctx.beginPath();
      ctx.ellipse(
        0,
        0,
        Math.max(0.5, shape.radiusX * scale),
        Math.max(0.5, shape.radiusY * scale),
        0,
        0,
        Math.PI * 2
      );
      if (filled) ctx.fill();
      if (stroked) ctx.stroke();
      break;
    }
    case 'triangle': {
      const p = shape.points;
      ctx.beginPath();
      ctx.moveTo(p[0] * scale, p[1] * scale);
      for (let i = 2; i < p.length; i += 2) {
        ctx.lineTo(p[i] * scale, p[i + 1] * scale);
      }
      ctx.closePath();
      if (filled) ctx.fill();
      if (stroked) ctx.stroke();
      break;
    }
    case 'line': {
      const p = shape.points;
      ctx.beginPath();
      ctx.moveTo(p[0] * scale, p[1] * scale);
      ctx.lineTo(p[2] * scale, p[3] * scale);
      ctx.stroke();
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

/**
 * Render a list of shapes onto a 64x64 grayscale canvas and return:
 *   - dataUrl: PNG data URL 
 *   - pixels:  Float32Array of length 64*64 with values in [0,1]
 */
export function rasterizeShapes(shapes) {
  const canvas = document.createElement('canvas');
  canvas.width = TARGET_SIZE;
  canvas.height = TARGET_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, TARGET_SIZE, TARGET_SIZE);

  const scale = TARGET_SIZE / CANVAS_SIZE;
  for (const shape of shapes) {
    drawShape(ctx, shape, scale);
  }

  const dataUrl = canvas.toDataURL('image/png');
  const imageData = ctx.getImageData(0, 0, TARGET_SIZE, TARGET_SIZE);
  const pixels = new Float32Array(TARGET_SIZE * TARGET_SIZE);
  for (let i = 0; i < TARGET_SIZE * TARGET_SIZE; i++) {
    pixels[i] = (imageData.data[i * 4] + imageData.data[i * 4 + 1] + imageData.data[i * 4 + 2]) / (3 * 255);
  }
  return { dataUrl, pixels };
}

export function dataUrlToBase64(dataUrl) {
  const idx = dataUrl.indexOf(',');
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
}

/**
 * Threshold below which a pixel counts as "background" during binarization.
 */
const BG_THRESHOLD = 0.06;

export function pngBase64ToPixels(base64) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = TARGET_SIZE;
      canvas.height = TARGET_SIZE;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, TARGET_SIZE, TARGET_SIZE);
      ctx.drawImage(img, 0, 0, TARGET_SIZE, TARGET_SIZE);
      const data = ctx.getImageData(0, 0, TARGET_SIZE, TARGET_SIZE).data;
      const pixels = new Float32Array(TARGET_SIZE * TARGET_SIZE);
      for (let i = 0; i < TARGET_SIZE * TARGET_SIZE; i++) {
        const gray = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / (3 * 255);
        pixels[i] = gray > BG_THRESHOLD ? 1 : 0;
      }
      resolve(pixels);
    };
    img.onerror = () => reject(new Error('Не удалось декодировать PNG'));
    img.src = `data:image/png;base64,${base64}`;
  });
}

let nextId = 1;
function newShapeId() {
  return `s${Date.now().toString(36)}-${nextId++}`;
}

export function makeDefaultShape(type, fill = '#ffffff') {
  const c = CANVAS_SIZE / 2;
  const base = {
    id: newShapeId(),
    type,
    fill,
    stroke: fill,
    strokeWidth: 2,
    filled: true,
    stroked: false,
    rotation: 0,
  };
  switch (type) {
    case 'rect':
            return { ...base, x: c - 40, y: c - 30, width: 80, height: 60 };
    case 'circle':
      return { ...base, x: c, y: c, radius: 40 };
    case 'ellipse':
      return { ...base, x: c, y: c, radiusX: 50, radiusY: 30 };
    case 'triangle':
      return { ...base, x: c, y: c, points: [0, -40, -40, 30, 40, 30] };
    case 'line':
      return {
        ...base,
        x: c,
        y: c,
        points: [-40, 0, 40, 0],
        filled: false,
        stroked: true,
        strokeWidth: 4,
      };
    default:
      throw new Error(`Unknown shape type: ${type}`);
  }
}
