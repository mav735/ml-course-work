import { getDrawings } from '../api/client.js';
import { pngBase64ToPixels } from './shapes.js';

const S = 64;

/**
 * Build a training dataset from drawings stored in the backend.
 *
 * labelA → class 0, labelB → class 1.
 *
 * Returns:
 *   {
 *     pixels:  Float32Array [N*64*64],
 *     labels:  Int32Array [N],
 *     N:       number,
 *     vizExamples: { classA: [{pixels}], classB: [{pixels}] },
 *     counts: { [labelA]: number, [labelB]: number }
 *   }
 */
export async function buildDatasetFromAPI(labelA, labelB, onProgress) {
  if (onProgress) onProgress(0, 'Загружаю рисунки…');

  const [aDrawings, bDrawings] = await Promise.all([
    getDrawings(labelA, 2000),
    getDrawings(labelB, 2000),
  ]);

  if (aDrawings.length === 0 || bDrawings.length === 0) {
    throw new Error(
      `Нужно хотя бы по одному рисунку на каждый класс. ` +
        `Сейчас: ${labelA}=${aDrawings.length}, ${labelB}=${bDrawings.length}.`
    );
  }

  const total = aDrawings.length + bDrawings.length;
  const pixels = new Float32Array(total * S * S);
  const labels = new Int32Array(total);

  const items = [
    ...aDrawings.map((d) => ({ ...d, classIdx: 0 })),
    ...bDrawings.map((d) => ({ ...d, classIdx: 1 })),
  ];

  // shuffle
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }

  for (let i = 0; i < items.length; i++) {
    const px = await pngBase64ToPixels(items[i].png_base64);
    pixels.set(px, i * S * S);
    labels[i] = items[i].classIdx;
    if (onProgress && (i % 8 === 0 || i === items.length - 1)) {
      onProgress(Math.round(((i + 1) / items.length) * 100), `Декодирую ${i + 1}/${items.length}`);
    }
  }

  // Build viz examples: up to 10 of each class
  const vizClassA = [];
  for (let i = 0; i < Math.min(10, aDrawings.length); i++) {
    const px = await pngBase64ToPixels(aDrawings[i].png_base64);
    vizClassA.push({ pixels: px });
  }
  const vizClassB = [];
  for (let i = 0; i < Math.min(10, bDrawings.length); i++) {
    const px = await pngBase64ToPixels(bDrawings[i].png_base64);
    vizClassB.push({ pixels: px });
  }

  return {
    pixels,
    labels,
    N: total,
    vizExamples: { classA: vizClassA, classB: vizClassB },
    counts: { [labelA]: aDrawings.length, [labelB]: bDrawings.length },
  };
}
