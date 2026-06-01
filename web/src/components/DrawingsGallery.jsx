import React from 'react';

export default function DrawingsGallery({ drawings, loading, error }) {
  if (loading) {
    return <div className="text-slate-400 text-sm py-2">Загружаем рисунки…</div>;
  }

  if (error) {
    return <div className="text-red-400 text-sm py-2">Ошибка: {error}</div>;
  }

  if (!drawings || drawings.length === 0) {
    return (
      <div className="text-slate-500 text-sm italic py-2">
        Пока никто не нарисовал. Будьте первым!
      </div>
    );
  }

  return (
    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-64 overflow-y-auto p-1">
      {drawings.map((d) => (
        <div
          key={d.id}
          className="bg-slate-900 border border-slate-700 rounded p-1 flex flex-col items-center"
          title={`${d.nickname} · #${d.id}`}
        >
          <img
            src={`data:image/png;base64,${d.png_base64}`}
            alt={d.nickname}
            className="w-full aspect-square object-contain pixelated"
          />
          <div className="text-[10px] text-slate-500 truncate w-full text-center mt-1">
            {d.nickname}
          </div>
        </div>
      ))}
    </div>
  );
}
