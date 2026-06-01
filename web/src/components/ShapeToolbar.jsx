import React from 'react';

const TOOLS = [
  { type: 'rect', label: '▭', title: 'Прямоугольник' },
  { type: 'circle', label: '◯', title: 'Круг' },
  { type: 'ellipse', label: '⬭', title: 'Эллипс' },
  { type: 'triangle', label: '△', title: 'Треугольник' },
  { type: 'line', label: '╱', title: 'Линия' },
];

const PALETTE = ['#ffffff', '#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#94a3b8'];

export default function ShapeToolbar({
  onAdd,
  fill,
  setFill,
  onClear,
  onUndo,
  canUndo,
  onDeleteSelected,
  hasSelection,
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-900 border border-slate-700 rounded-lg">
      <div className="flex gap-1">
        {TOOLS.map((t) => (
          <button
            key={t.type}
            onClick={() => onAdd(t.type)}
            title={t.title}
            className="w-10 h-10 flex items-center justify-center text-lg rounded-md bg-slate-700 hover:bg-slate-600 text-white"
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="h-8 w-px bg-slate-700" />

      <div className="flex items-center gap-1">
        <span className="text-xs text-slate-400 mr-1">цвет:</span>
        {PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => setFill(c)}
            title={c}
            className={`w-7 h-7 rounded-md border-2 ${
              fill === c ? 'border-indigo-400' : 'border-transparent'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <div className="ml-auto flex gap-2">
        <button
          onClick={onDeleteSelected}
          disabled={!hasSelection}
          className="btn-danger disabled:opacity-40 disabled:cursor-not-allowed"
          title="Удалить выделенную фигуру (Delete)"
        >
          Удалить
        </button>
        <button onClick={onUndo} disabled={!canUndo} className="btn-secondary disabled:opacity-50">
          Отменить
        </button>
        <button onClick={onClear} className="btn-secondary">Очистить</button>
      </div>
    </div>
  );
}
