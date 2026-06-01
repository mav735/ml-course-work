import React, { useEffect, useRef } from 'react';

const CHART_W = 600;
const CHART_H = 260;
const PAD = { top: 20, right: 60, bottom: 40, left: 60 };

function drawTrainingChart(canvas, history) {
  if (!canvas || history.length === 0) return;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, CHART_W, CHART_H);

  const plotW = CHART_W - PAD.left - PAD.right;
  const plotH = CHART_H - PAD.top - PAD.bottom;

  ctx.fillStyle = '#141418';
  ctx.fillRect(0, 0, CHART_W, CHART_H);

  ctx.strokeStyle = '#1d1d22';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = PAD.top + (plotH * i) / 5;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + plotW, y);
    ctx.stroke();
  }

  const epochs = history.length;
  const losses = history.map((h) => h.loss);
  const valLosses = history.map((h) => h.valLoss);
  const accs = history.map((h) => h.acc);
  const valAccs = history.map((h) => h.valAcc);

  const maxLoss = Math.max(...losses, ...valLosses, 0.1);
  const minLoss = 0;

  function xPos(i) {
    return PAD.left + (i / Math.max(epochs - 1, 1)) * plotW;
  }
  function yLoss(v) {
    return PAD.top + plotH - ((v - minLoss) / (maxLoss - minLoss + 1e-8)) * plotH;
  }
  function yAcc(v) {
    return PAD.top + plotH - v * plotH;
  }

  function drawLine(data, yFn, color, dash = []) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(dash);
    data.forEach((v, i) => {
      if (i === 0) ctx.moveTo(xPos(i), yFn(v));
      else ctx.lineTo(xPos(i), yFn(v));
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawLine(losses, yLoss, '#f87171');
  drawLine(valLosses, yLoss, '#fb923c', [4, 4]);
  drawLine(accs, yAcc, '#34d399');
  drawLine(valAccs, yAcc, '#60a5fa', [4, 4]);

  function dot(x, y, color) {
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  if (epochs > 0) {
    const last = epochs - 1;
    dot(xPos(last), yLoss(losses[last]), '#f87171');
    dot(xPos(last), yLoss(valLosses[last]), '#fb923c');
    dot(xPos(last), yAcc(accs[last]), '#34d399');
    dot(xPos(last), yAcc(valAccs[last]), '#60a5fa');
  }

  ctx.strokeStyle = '#42424a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.left, PAD.top);
  ctx.lineTo(PAD.left, PAD.top + plotH);
  ctx.lineTo(PAD.left + plotW, PAD.top + plotH);
  ctx.stroke();

  ctx.fillStyle = '#a8a8ad';
  ctx.font = '11px monospace';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 5; i++) {
    const v = minLoss + ((maxLoss - minLoss) * (5 - i)) / 5;
    const y = PAD.top + (plotH * i) / 5;
    ctx.fillText(v.toFixed(2), PAD.left - 6, y + 4);
  }

  ctx.textAlign = 'left';
  for (let i = 0; i <= 5; i++) {
    const v = ((5 - i) / 5) * 100;
    const y = PAD.top + (plotH * i) / 5;
    ctx.fillText(`${v.toFixed(0)}%`, PAD.left + plotW + 6, y + 4);
  }

  ctx.textAlign = 'center';
  const step = Math.max(1, Math.floor(epochs / 8));
  for (let i = 0; i < epochs; i += step) {
    ctx.fillText(`${i + 1}`, xPos(i), PAD.top + plotH + 16);
  }

  ctx.fillStyle = '#7d7d83';
  ctx.font = '11px monospace';
  ctx.save();
  ctx.translate(12, PAD.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f87171';
  ctx.fillText('Loss', 0, 0);
  ctx.restore();

  ctx.save();
  ctx.translate(CHART_W - 10, PAD.top + plotH / 2);
  ctx.rotate(Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#34d399';
  ctx.fillText('Accuracy', 0, 0);
  ctx.restore();

  const legends = [
    { color: '#f87171', label: 'Train Loss', dash: [] },
    { color: '#fb923c', label: 'Val Loss', dash: [4, 4] },
    { color: '#34d399', label: 'Train Acc', dash: [] },
    { color: '#60a5fa', label: 'Val Acc', dash: [4, 4] },
  ];
  let lx = PAD.left + 10;
  const ly = PAD.top + 8;
  ctx.font = '10px monospace';
  for (const leg of legends) {
    ctx.strokeStyle = leg.color;
    ctx.lineWidth = 2;
    ctx.setLineDash(leg.dash);
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + 20, ly);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = leg.color;
    ctx.textAlign = 'left';
    ctx.fillText(leg.label, lx + 24, ly + 4);
    lx += 90;
  }
}

export default function TrainingPanel({
  epochs,
  setEpochs,
  lr,
  setLr,
  batchSize,
  setBatchSize,
  onTrain,
  training,
  trainingHistory,
  datasetReady,
}) {
  const chartRef = useRef(null);

  useEffect(() => {
    drawTrainingChart(chartRef.current, trainingHistory);
  }, [trainingHistory]);

  const lastEntry = trainingHistory[trainingHistory.length - 1];

  return (
    <div className="section-card">
      <h2 className="section-title">
        Обучение
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="label-text">
            Эпохи: <span className="text-indigo-400 font-bold">{epochs}</span>
          </label>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={epochs}
            onChange={(e) => setEpochs(Number(e.target.value))}
            className="w-full accent-indigo-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>1</span><span>20</span>
          </div>
        </div>

        <div>
          <label className="label-text">Скорость обучения</label>
          <select value={lr} onChange={(e) => setLr(Number(e.target.value))} className="input-field w-full">
            <option value={0.01}>1e-2</option>
            <option value={0.001}>1e-3</option>
            <option value={0.0001}>1e-4</option>
          </select>
        </div>

        <div>
          <label className="label-text">Размер батча</label>
          <select value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value))} className="input-field w-full">
            {[16, 32, 64, 128].map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col justify-end">
          <button
            onClick={onTrain}
            disabled={training || !datasetReady}
            className="btn-primary"
          >
            {training ? 'Обучение…' : 'Обучить модель'}
          </button>
          {!datasetReady && (
            <p className="text-xs text-slate-500 mt-1">Сначала загрузите датасет</p>
          )}
        </div>
      </div>

      {trainingHistory.length > 0 && (
        <>
          <canvas
            ref={chartRef}
            width={CHART_W}
            height={CHART_H}
            className="w-full rounded-lg border border-slate-700 mb-4"
            style={{ maxWidth: CHART_W }}
          />

          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="text-slate-500 border-b border-slate-700">
                  <th className="text-left py-1 px-2">Эпоха</th>
                  <th className="text-right py-1 px-2">Loss</th>
                  <th className="text-right py-1 px-2">Acc</th>
                  <th className="text-right py-1 px-2">Val Loss</th>
                  <th className="text-right py-1 px-2">Val Acc</th>
                </tr>
              </thead>
              <tbody>
                {trainingHistory.slice(-10).map((h) => (
                  <tr key={h.epoch} className="border-b border-slate-800 hover:bg-slate-900">
                    <td className="py-1 px-2 text-slate-400">{h.epoch}</td>
                    <td className="py-1 px-2 text-right text-red-400">{h.loss.toFixed(4)}</td>
                    <td className="py-1 px-2 text-right text-emerald-400">{(h.acc * 100).toFixed(1)}%</td>
                    <td className="py-1 px-2 text-right text-orange-400">{h.valLoss.toFixed(4)}</td>
                    <td className="py-1 px-2 text-right text-blue-400">{(h.valAcc * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {lastEntry && (
            <div className="mt-3 flex gap-6 text-sm">
              <span className="text-slate-400">Итог:
                <span className="text-emerald-400 ml-2 font-bold">{(lastEntry.acc * 100).toFixed(1)}% обучение</span>
                <span className="text-blue-400 ml-2 font-bold">{(lastEntry.valAcc * 100).toFixed(1)}% валидация</span>
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
