import React, { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import { extractTopKChannels } from '../utils/activations.js';
import { renderMapToCanvas, renderGrayscaleToCanvas } from '../utils/colormap.js';

const S = 64;

function ChannelCanvas({ mapData, H, W, channelIdx }) {
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
      <span className="text-xs text-slate-500 font-mono">ch {channelIdx}</span>
    </div>
  );
}

function InputThumb({ pixels }) {
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
        className="rounded border border-indigo-600"
      />
      <span className="text-xs text-slate-500 font-mono">Вход</span>
    </div>
  );
}

export default function TopKChannels({ model, vizExamples, labelNames = ['Кот', 'Пёс'] }) {
  const [labelA, labelB] = labelNames;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const examplesA = vizExamples?.classA || [];
  const examplesB = vizExamples?.classB || [];

  useEffect(() => {
    if (!model || examplesA.length === 0 || examplesB.length === 0) return;
    compute();
  }, [model, vizExamples]);

  async function compute() {
    setLoading(true);
    setError(null);
    try {
      const pixelsA = examplesA[0].pixels;
      const pixelsB = examplesB[0].pixels;

      const tensorA = tf.tensor4d(pixelsA, [1, S, S, 1]);
      const tensorB = tf.tensor4d(pixelsB, [1, S, S, 1]);

      const result = await extractTopKChannels(model, tensorA, tensorB, 6);

      tensorA.dispose();
      tensorB.dispose();

      if (!result) {
        setError('В модели нет свёрточных слоёв.');
        return;
      }

      setData({
        ...result,
        pixelsA,
        pixelsB,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="text-slate-400 text-sm py-8 text-center">
        Вычисляю топ-K каналов…
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-400 text-sm py-8 text-center">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-slate-500 text-sm py-8 text-center">
        Ожидание модели и примеров…
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300 mb-1">
          {labelA} — топ-6 каналов слоя <span className="font-mono text-indigo-400">{data.layerName}</span>
        </h3>
        <p className="text-xs text-slate-500 mb-3">Каналы с максимальной средней активацией</p>
        <div className="flex flex-wrap gap-3">
          <InputThumb pixels={data.pixelsA} />
          {data.channelsA.map((ch, i) => (
            <ChannelCanvas key={i} mapData={ch.mapData} H={ch.H} W={ch.W} channelIdx={ch.channelIdx} />
          ))}
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300 mb-1">
          {labelB} — топ-6 каналов слоя <span className="font-mono text-indigo-400">{data.layerName}</span>
        </h3>
        <p className="text-xs text-slate-500 mb-3">Каналы с максимальной средней активацией</p>
        <div className="flex flex-wrap gap-3">
          <InputThumb pixels={data.pixelsB} />
          {data.channelsB.map((ch, i) => (
            <ChannelCanvas key={i} mapData={ch.mapData} H={ch.H} W={ch.W} channelIdx={ch.channelIdx} />
          ))}
        </div>
      </div>
    </div>
  );
}
