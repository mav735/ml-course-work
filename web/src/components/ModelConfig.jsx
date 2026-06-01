import React, { useState, useRef } from 'react';
import { DEFAULT_LAYERS } from '../utils/model.js';

const LAYER_INFO = {
  conv: {
    title: 'Свёрточный слой (Conv2D)',
    color: 'indigo',
    description:
      'Свёрточный слой скользит небольшими обучаемыми фильтрами (ядрами) по входу и строит карту признаков для каждого фильтра. Ранние слои улавливают простые признаки — края и углы; более глубокие слои объединяют их в сложные паттерны, например уши или морду.',
    params: [
      {
        name: 'Фильтры',
        key: 'filters',
        options: [8, 16, 32, 64, 128],
        description:
          'Количество различных фильтров, которые обучает этот слой. Больше фильтров — больше улавливаемых признаков, но и больше параметров и вычислений. Обычно их число удваивается с глубиной сети.',
      },
      {
        name: 'Размер ядра',
        key: 'kernelSize',
        options: [3, 5],
        format: (v) => `${v}×${v}`,
        description:
          'Пространственный размер каждого фильтра. Ядро 3×3 смотрит на окрестность 3×3 пикселя за раз. Большие ядра охватывают больше контекста, но добавляют параметров.',
      },
    ],
  },
  pool: {
    title: 'Слой пулинга (Pool2D)',
    color: 'teal',
    description:
      'Слой пулинга скользит окном 2×2 по карте признаков с шагом 2, уменьшая пространственные размеры вдвое. Это ускоряет сеть, снижает переобучение и добавляет инвариантность к сдвигу — модель меньше зависит от того, где именно появляется признак.',
    params: [
      {
        name: 'Тип пулинга',
        key: 'poolType',
        options: ['max', 'avg'],
        format: (v) => v === 'max' ? 'Max-пулинг' : 'Average-пулинг',
        description:
          'Max-пулинг сохраняет самую сильную активацию в каждом окне — хорошо определяет, присутствует ли признак (например, кончик уха) где-либо в области. Average-пулинг усредняет все активации — даёт более гладкие карты, отражающие общую интенсивность, а не резкие пики.',
      },
    ],
  },
  gap: {
    title: 'Global Average Pooling (GAP)',
    color: 'amber',
    description:
      'Global Average Pooling сворачивает каждую карту признаков в одно число, усредняя все её значения. Вместо большого плоского вектора получается одно значение на канал — это резко сокращает число параметров и работает как сильная регуляризация. Также это напрямую позволяет строить визуализации Grad-CAM.',
    params: [],
  },
  output: {
    title: 'Выходной слой (Dense)',
    color: 'green',
    description:
      'Полносвязный (Dense) слой, который отображает 64 выхода GAP в 2 оценки классов. Во время обучения softmax + кросс-энтропия повышают оценку правильного класса. Предсказанный класс — тот, у которого оценка наибольшая.',
    params: [],
  },
};

function InfoModal({ info, layer, onClose, onParamChange }) {
  if (!info) return null;

  const colorMap = {
    indigo: { badge: 'bg-indigo-900 text-indigo-200', border: 'border-indigo-700', accent: 'text-indigo-400' },
    teal:   { badge: 'bg-teal-900 text-teal-200',     border: 'border-teal-700',   accent: 'text-teal-400' },
    amber:  { badge: 'bg-amber-900 text-amber-200',   border: 'border-amber-700',  accent: 'text-amber-400' },
    green:  { badge: 'bg-green-900 text-green-200',   border: 'border-green-700',  accent: 'text-green-400' },
  };
  const c = colorMap[info.color] || colorMap.indigo;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className={`bg-slate-800 rounded-2xl border ${c.border} shadow-2xl w-full max-w-lg mx-4 p-6`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${c.badge} mr-2`}>
              {info.color === 'indigo' ? 'CONV' : info.color === 'teal' ? 'POOL' : info.color === 'amber' ? 'GAP' : 'OUT'}
            </span>
            <span className={`text-sm font-semibold ${c.accent}`}>{info.title}</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors text-lg leading-none ml-4"
          >
            &times;
          </button>
        </div>

        <p className="text-slate-300 text-sm leading-relaxed mb-5">{info.description}</p>

        {info.params.length > 0 && (
          <div className="space-y-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Параметры</p>
            {info.params.map((param) => (
              <div key={param.key} className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-200">{param.name}</span>
                  {layer && onParamChange && (
                    <select
                      value={layer[param.key]}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        onParamChange(param.key, Number.isNaN(n) ? e.target.value : n);
                      }}
                      className="input-field text-sm py-1 px-2"
                    >
                      {param.options.map((v) => (
                        <option key={v} value={v}>
                          {param.format ? param.format(v) : v}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{param.description}</p>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-5 w-full btn-secondary text-sm"
        >
          Закрыть
        </button>
      </div>
    </div>
  );
}

function LayerBadge({ type, onClick }) {
  const styles = {
    input:  'bg-slate-700 text-slate-400',
    conv:   'bg-indigo-900 text-indigo-300 hover:bg-indigo-800',
    pool:   'bg-teal-900 text-teal-300 hover:bg-teal-800',
    gap:    'bg-amber-900 text-amber-300 hover:bg-amber-800',
    output: 'bg-green-900 text-green-300 hover:bg-green-800',
  };
  const labels = { input: 'INPUT', conv: 'CONV', pool: 'POOL', gap: 'GAP', out: 'OUT', output: 'OUT' };

  return (
    <button
      onClick={onClick}
      className={`text-xs font-bold px-2 py-0.5 rounded transition-colors ${styles[type] || styles.conv} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
      title={onClick ? 'Нажмите, чтобы узнать о слое' : undefined}
    >
      {labels[type] || type.toUpperCase()}
    </button>
  );
}

function LayerRow({ layer, index, onRemove, onChange, canRemove, onBadgeClick, onDragStart, onDragOver, onDrop, isDragOver }) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(index); }}
      onDrop={(e) => onDrop(e, index)}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 border transition-colors cursor-grab active:cursor-grabbing select-none
        ${isDragOver ? 'border-indigo-500 bg-indigo-950' : 'bg-slate-900 border-slate-700'}`}
    >
      <span className="text-slate-600 text-sm flex-shrink-0" title="Перетащите для изменения порядка">
        <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
          <circle cx="3" cy="3" r="1.5"/><circle cx="9" cy="3" r="1.5"/>
          <circle cx="3" cy="8" r="1.5"/><circle cx="9" cy="8" r="1.5"/>
          <circle cx="3" cy="13" r="1.5"/><circle cx="9" cy="13" r="1.5"/>
        </svg>
      </span>

      <span className="text-slate-500 text-xs w-5 flex-shrink-0">{index + 1}</span>

      <LayerBadge type={layer.type} onClick={() => onBadgeClick(layer.type, index)} />

      <span className="text-slate-300 text-sm font-mono flex-1 min-w-0 truncate">{layer.name}</span>

      {layer.type === 'conv' && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <label className="text-xs text-slate-500">фильтры</label>
          <select
            value={layer.filters}
            onChange={(e) => onChange(index, { ...layer, filters: Number(e.target.value) })}
            className="input-field text-sm py-1 px-2"
          >
            {[8, 16, 32, 64, 128].map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          <label className="text-xs text-slate-500">ядро</label>
          <select
            value={layer.kernelSize || 3}
            onChange={(e) => onChange(index, { ...layer, kernelSize: Number(e.target.value) })}
            className="input-field text-sm py-1 px-2"
          >
            {[3, 5].map((k) => (
              <option key={k} value={k}>{k}&times;{k}</option>
            ))}
          </select>
        </div>
      )}

      {layer.type === 'pool' && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            value={layer.poolType || 'max'}
            onChange={(e) => onChange(index, { ...layer, poolType: e.target.value })}
            className="input-field text-sm py-1 px-2"
          >
            <option value="max">Макс</option>
            <option value="avg">Среднее</option>
          </select>
          <span className="text-slate-500 text-xs">2&times;2, шаг 2</span>
        </div>
      )}

      {canRemove && (
        <button
          onClick={() => onRemove(index)}
          className="btn-danger ml-2 flex-shrink-0 text-xs px-2 py-1"
          title="Удалить слой"
        >
          Удалить
        </button>
      )}
    </div>
  );
}

function FixedRow({ type, label, onBadgeClick }) {
  return (
    <div className="flex items-center gap-3 bg-slate-900 rounded-lg px-3 py-2 border border-slate-700/50 opacity-60">
      <span className="w-[28px]" />
      <span className="text-slate-500 text-xs w-5" />
      <LayerBadge type={type} onClick={onBadgeClick} />
      <span className="text-slate-400 text-sm font-mono">{label}</span>
    </div>
  );
}

export default function ModelConfig({ layers, setLayers, paramCount }) {
  const [modal, setModal] = useState(null); // { info, layerIndex }
  const dragIndexRef = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  function handleDragStart(e, index) {
    dragIndexRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(index) {
    setDragOverIndex(index);
  }

  function handleDrop(e, dropIndex) {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from === null || from === dropIndex) { setDragOverIndex(null); return; }
    const next = [...layers];
    const [moved] = next.splice(from, 1);
    next.splice(dropIndex, 0, moved);
    setLayers(next);
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }

  function addConv() {
    const count = layers.filter((l) => l.type === 'conv').length + 1;
    setLayers([...layers, { type: 'conv', name: `conv${count}`, filters: 32, kernelSize: 3 }]);
  }

  function addPool() {
    const count = layers.filter((l) => l.type === 'pool').length + 1;
    setLayers([...layers, { type: 'pool', name: `pool${count}`, poolType: 'max' }]);
  }

  function removeLayer(index) {
    setLayers(layers.filter((_, i) => i !== index));
  }

  function updateLayer(index, newLayer) {
    setLayers(layers.map((l, i) => (i === index ? newLayer : l)));
  }

  function reset() {
    setLayers(DEFAULT_LAYERS.map((l) => ({ ...l })));
  }

  function openModal(type, layerIndex = null) {
    const info = LAYER_INFO[type] || LAYER_INFO[type === 'out' ? 'output' : type];
    if (!info) return;
    setModal({ info, layerIndex });
  }

  function handleParamChange(key, value) {
    if (modal?.layerIndex == null) return;
    updateLayer(modal.layerIndex, { ...layers[modal.layerIndex], [key]: value });
    setModal((m) => ({ ...m }));
  }

  const canRemove = layers.length > 1;

  return (
    <div className="section-card">
      <h2 className="section-title">Архитектура модели</h2>

      <p className="text-sm text-slate-400 mb-4">
        Нажмите на бейдж слоя (CONV, POOL, GAP, OUT), чтобы узнать, что он делает, и настроить его параметры. Перетаскивайте строки для изменения порядка.
      </p>

      <div className="flex flex-col gap-2 mb-4" onDragLeave={() => setDragOverIndex(null)} onDragEnd={handleDragEnd}>
        <FixedRow type="input" label="вход  [batch, 64, 64, 1]" />

        {layers.map((layer, i) => (
          <LayerRow
            key={`${layer.name}-${i}`}
            layer={layer}
            index={i}
            onRemove={removeLayer}
            onChange={updateLayer}
            canRemove={canRemove}
            onBadgeClick={openModal}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            isDragOver={dragOverIndex === i}
          />
        ))}

        <FixedRow
          type="gap"
          label="GlobalAveragePooling2D"
          onBadgeClick={() => openModal('gap')}
        />
        <FixedRow
          type="output"
          label="Dense(2)  — класс 1 / класс 2"
          onBadgeClick={() => openModal('output')}
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={addConv} className="btn-secondary text-sm">+ Conv-слой</button>
        <button onClick={addPool} className="btn-secondary text-sm">+ Pool-слой</button>
        <button onClick={reset} className="btn-secondary text-sm ml-auto">Сбросить по умолчанию</button>
      </div>

      <div className="bg-slate-900 rounded-lg px-4 py-3 border border-slate-700 flex items-center gap-4">
        <span className="text-slate-400 text-sm">Всего параметров:</span>
        <span className="text-indigo-400 font-bold font-mono">
          {paramCount !== null ? paramCount.toLocaleString() : '—'}
        </span>
        <span className="text-slate-500 text-xs">(оценка после компиляции)</span>
      </div>

      {modal && (
        <InfoModal
          info={modal.info}
          layer={modal.layerIndex != null ? layers[modal.layerIndex] : null}
          onClose={() => setModal(null)}
          onParamChange={handleParamChange}
        />
      )}
    </div>
  );
}
