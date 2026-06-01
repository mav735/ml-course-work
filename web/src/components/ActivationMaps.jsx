import React, { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import { buildActivationModel, extractActivations } from '../utils/activations.js';
import { renderMapToCanvas, renderGrayscaleToCanvas, infernoRGB } from '../utils/colormap.js';

const S = 64;

function ActivationCanvas({ mapData, H, W, label }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!mapData || !canvasRef.current) return;
    renderMapToCanvas(canvasRef.current, mapData, H, W);
  }, [mapData, H, W]);

  return (
    <div className="flex flex-col items-center gap-1">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{ width: 80, height: 80, imageRendering: 'pixelated' }}
        className="rounded border border-slate-600"
      />
      <span className="text-xs text-slate-500 font-mono">{label}</span>
    </div>
  );
}

function InputCanvas({ pixels }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!pixels || !canvasRef.current) return;
    renderGrayscaleToCanvas(canvasRef.current, pixels, S, S);
  }, [pixels]);

  return (
    <div className="flex flex-col items-center gap-1">
      <canvas
        ref={canvasRef}
        width={S}
        height={S}
        style={{ width: 80, height: 80, imageRendering: 'pixelated' }}
        className="rounded border border-slate-600"
      />
      <span className="text-xs text-slate-500 font-mono">Вход</span>
    </div>
  );
}

export default function ActivationMaps({ model, vizExamples, labelNames = ['Кот', 'Пёс'] }) {
  const [labelA, labelB] = labelNames;
  const [mode, setMode] = useState('mean');
  const [idxA, setIdxA] = useState(0);
  const [idxB, setIdxB] = useState(0);
  const [activationsA, setActivationsA] = useState(null);
  const [activationsB, setActivationsB] = useState(null);
  const [loading, setLoading] = useState(false);

  const examplesA = vizExamples?.classA || [];
  const examplesB = vizExamples?.classB || [];

  const actModelRef = useRef(null);
  const actLayerNamesRef = useRef([]);

  useEffect(() => {
    if (!model) return;

    const result = buildActivationModel(model);
    if (result) {
      actModelRef.current = result.model;
      actLayerNamesRef.current = result.layerNames;
    }
  }, [model]);

  useEffect(() => {
    if (!actModelRef.current || examplesA.length === 0 || examplesB.length === 0) return;
    runExtraction();
  }, [model, vizExamples, idxA, idxB]);

  async function runExtraction() {
    if (!actModelRef.current) return;
    setLoading(true);
    try {
      const exampleA = examplesA[idxA];
      const exampleB = examplesB[idxB];

      const tensorA = tf.tensor4d(exampleA.pixels, [1, S, S, 1]);
      const tensorB = tf.tensor4d(exampleB.pixels, [1, S, S, 1]);

      const actsA = await extractActivations(actModelRef.current, actLayerNamesRef.current, tensorA);
      const actsB = await extractActivations(actModelRef.current, actLayerNamesRef.current, tensorB);

      tensorA.dispose();
      tensorB.dispose();

      setActivationsA({ acts: actsA, pixels: exampleA.pixels });
      setActivationsB({ acts: actsB, pixels: exampleB.pixels });
    } catch (e) {
      console.error('Activation extraction failed:', e);
    } finally {
      setLoading(false);
    }
  }

  function navigate(which, dir) {
    if (which === 'a') {
      setIdxA((i) => (i + dir + examplesA.length) % examplesA.length);
    } else {
      setIdxB((i) => (i + dir + examplesB.length) % examplesB.length);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <span className="text-sm text-slate-400">Тип карты:</span>
        <div className="flex gap-2">
          {['mean', 'max'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                mode === m ? 'tab-active' : 'tab-inactive'
              }`}
            >
              {m === 'mean' ? 'Avg активация' : 'Макс. активация'}
            </button>
          ))}
        </div>
        {loading && <span className="text-sm text-slate-500 animate-pulse">Вычисляю…</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Class A */}
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-300">
              {labelA} <span className="font-normal text-slate-500">({examplesA.length} примеров)</span>
            </h3>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('a', -1)} className="btn-secondary text-xs py-1 px-2">←</button>
              <span className="text-xs text-slate-500">{idxA + 1}/{examplesA.length}</span>
              <button onClick={() => navigate('a', 1)} className="btn-secondary text-xs py-1 px-2">→</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {activationsA ? (
              <>
                <InputCanvas pixels={activationsA.pixels} />
                {activationsA.acts.map((act) => (
                  <ActivationCanvas
                    key={act.name}
                    mapData={mode === 'mean' ? act.meanMap : act.maxMap}
                    H={act.H}
                    W={act.W}
                    label={act.name}
                  />
                ))}
              </>
            ) : (
              <p className="text-slate-500 text-sm">Загрузка…</p>
            )}
          </div>
        </div>

        {/* Class B */}
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-300">
              {labelB} <span className="font-normal text-slate-500">({examplesB.length} примеров)</span>
            </h3>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('b', -1)} className="btn-secondary text-xs py-1 px-2">←</button>
              <span className="text-xs text-slate-500">{idxB + 1}/{examplesB.length}</span>
              <button onClick={() => navigate('b', 1)} className="btn-secondary text-xs py-1 px-2">→</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {activationsB ? (
              <>
                <InputCanvas pixels={activationsB.pixels} />
                {activationsB.acts.map((act) => (
                  <ActivationCanvas
                    key={act.name}
                    mapData={mode === 'mean' ? act.meanMap : act.maxMap}
                    H={act.H}
                    W={act.W}
                    label={act.name}
                  />
                ))}
              </>
            ) : (
              <p className="text-slate-500 text-sm">Загрузка…</p>
            )}
          </div>
        </div>
      </div>

      {/* Colormap legend */}
      <div className="mt-4 flex items-center gap-3">
        <span className="text-xs text-slate-500">Палитра Inferno:</span>
        <canvas
          ref={(el) => {
            if (!el) return;
            el.width = 200;
            el.height = 14;
            const ctx = el.getContext('2d');
            for (let x = 0; x < 200; x++) {
              const [r, g, b] = infernoRGB(x / 199);
              ctx.fillStyle = `rgb(${r},${g},${b})`;
              ctx.fillRect(x, 0, 1, 14);
            }
          }}
          style={{ borderRadius: 4 }}
        />
        <span className="text-xs text-slate-500">низкие → высокие</span>
      </div>
    </div>
  );
}
