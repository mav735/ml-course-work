import React, { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import { computeGradCAM } from '../utils/gradcam.js';
import { findConvLayerNames } from '../utils/activations.js';
import { renderGrayscaleToCanvas, jetRGB } from '../utils/colormap.js';

const S = 64;

/**
 * (jet colormap) to canvas.
 */
function renderHeatmap(canvas, camData) {
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(S, S);
  const d = imgData.data;
  for (let i = 0; i < S * S; i++) {
    const [r, g, b] = jetRGB(camData[i]);
    d[i * 4 + 0] = r;
    d[i * 4 + 1] = g;
    d[i * 4 + 2] = b;
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
}

/**
 * Render overlay: grayscale + heatmap at 45% opacity.
 */
function renderOverlay(canvas, pixels, camData) {
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(S, S);
  const d = imgData.data;
  const alpha = 0.45;

  for (let i = 0; i < S * S; i++) {
    const gray = Math.round(pixels[i] * 255);
    const [hr, hg, hb] = jetRGB(camData[i]);
    d[i * 4 + 0] = Math.round(gray * (1 - alpha) + hr * alpha);
    d[i * 4 + 1] = Math.round(gray * (1 - alpha) + hg * alpha);
    d[i * 4 + 2] = Math.round(gray * (1 - alpha) + hb * alpha);
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
}

function GradCAMRow({ label, pixels, classIdx, model, predictedName }) {
  const inputRef = useRef(null);
  const heatmapRef = useRef(null);
  const overlayRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!model || !pixels) return;
    renderGrayscaleToCanvas(inputRef.current, pixels, S, S);
    computeMap();
  }, [model, pixels, classIdx]);

  async function computeMap() {
    setLoading(true);
    setError(null);
    try {
      const tensor = tf.tensor4d(pixels, [1, S, S, 1]);
      const result = await computeGradCAM(model, tensor, classIdx);
      tensor.dispose();

      if (!result) {
        setError('В модели нет свёрточных слоёв.');
        return;
      }

      renderHeatmap(heatmapRef.current, result.cam);
      renderOverlay(overlayRef.current, pixels, result.cam);
    } catch (e) {
      console.error('GradCAM error:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const canvasStyle = { width: 128, height: 128, imageRendering: 'pixelated' };

  return (
    <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
      <h3 className="text-sm font-semibold text-slate-300 mb-3">
        {label} <span className="text-slate-500 font-normal">(предсказанный класс: {predictedName})</span>
      </h3>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-4 flex-wrap">
        <div className="flex flex-col items-center gap-1">
          <canvas ref={inputRef} width={S} height={S} style={canvasStyle} className="rounded border border-slate-600" />
          <span className="text-xs text-slate-500">Вход</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <canvas ref={heatmapRef} width={S} height={S} style={canvasStyle} className="rounded border border-slate-600" />
          <span className="text-xs text-slate-500">Grad-CAM (jet)</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <canvas ref={overlayRef} width={S} height={S} style={canvasStyle} className="rounded border border-slate-600" />
          <span className="text-xs text-slate-500">Наложение (45%)</span>
        </div>
        {loading && (
          <div className="flex items-center">
            <span className="text-slate-500 text-sm">Вычисляю градиенты…</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GradCAMView({ model, vizExamples, labelNames = ['Кот', 'Пёс'] }) {
  const [labelA, labelB] = labelNames;
  const examplesA = vizExamples?.classA || [];
  const examplesB = vizExamples?.classB || [];

  if (!examplesA.length || !examplesB.length) {
    return <div className="text-slate-500 text-sm py-8 text-center">Ожидание примеров…</div>;
  }

  const lastConv = model ? findConvLayerNames(model).at(-1) : null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Grad-CAM на слое <span className="font-mono text-indigo-400">{lastConv ?? '—'}</span> (последний свёрточный) — показывает, на какие области изображения смотрит сеть при предсказании каждого класса.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GradCAMRow
          label={`${labelA} — пример`}
          pixels={examplesA[0].pixels}
          classIdx={0}
          model={model}
          predictedName={labelA}
        />
        <GradCAMRow
          label={`${labelB} — пример`}
          pixels={examplesB[0].pixels}
          classIdx={1}
          model={model}
          predictedName={labelB}
        />
      </div>

      {/* Jet colormap legend */}
      <div className="flex items-center gap-3 mt-2">
        <span className="text-xs text-slate-500">Палитра Jet:</span>
        <canvas
          ref={(el) => {
            if (!el) return;
            el.width = 200;
            el.height = 14;
            const ctx = el.getContext('2d');
            for (let x = 0; x < 200; x++) {
              const [r, g, b] = jetRGB(x / 199);
              ctx.fillStyle = `rgb(${r},${g},${b})`;
              ctx.fillRect(x, 0, 1, 14);
            }
          }}
          style={{ borderRadius: 4 }}
        />
        <span className="text-xs text-slate-500">низкая → высокая активация</span>
      </div>
    </div>
  );
}
