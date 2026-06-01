import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getLabels, getStats } from '../api/client.js';
import { getNickname, setNickname, setLabelPair } from '../utils/session.js';

const LABEL_DISPLAY = {
  apple: { ru: 'Яблоко', icon: '🍎' },
  carrot: { ru: 'Морковь', icon: '🥕' },
  star: { ru: 'Звезда', icon: '⭐' },
  house: { ru: 'Дом', icon: '🏠' },
  tree: { ru: 'Дерево', icon: '🌳' },
  fish: { ru: 'Рыба', icon: '🐟' },
  sun: { ru: 'Солнце', icon: '☀️' },
  flower: { ru: 'Цветок', icon: '🌸' },
};

export default function Home() {
  const navigate = useNavigate();
  const [nick, setNick] = useState(getNickname());
  const [labels, setLabels] = useState([]);
  const [stats, setStats] = useState({});
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [labelsRes, statsRes] = await Promise.all([getLabels(), getStats()]);
        if (cancelled) return;
        setLabels(labelsRes.labels);
        setStats(statsRes.counts);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (label) => {
    setSelected((prev) => {
      if (prev.includes(label)) return prev.filter((l) => l !== label);
      if (prev.length >= 2) return [prev[1], label];
      return [...prev, label];
    });
  };

  const canStart = useMemo(
    () => nick.trim().length > 0 && selected.length === 2,
    [nick, selected]
  );

  const handleStart = () => {
    setNickname(nick.trim());
    setLabelPair(selected);
    navigate('/draw');
  };

  return (
    <div>
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="max-w-4xl mx-auto px-6 py-5">
          <div className="text-[11px] uppercase tracking-[0.2em] text-indigo-400 font-medium mb-1">
            Курсовая работа · Визуализатор ML
          </div>
          <h1 className="text-2xl font-semibold text-slate-50 tracking-tight">
            CNN на пользовательских рисунках
          </h1>
          <p className="text-slate-400 text-sm mt-1.5 max-w-2xl">
            Введите никнейм, выберите два класса — затем нарисуйте примеры или используйте уже собранные.
            Все рисунки складываются в общий датасет.
          </p>
          <div className="accent-rule mt-4" />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">

      <div className="section-card">
        <h2 className="section-title">1. Никнейм</h2>
        <input
          className="input-field w-full max-w-sm"
          placeholder="Например, Маша"
          value={nick}
          onChange={(e) => setNick(e.target.value.slice(0, 50))}
        />
      </div>

      <div className="section-card">
        <h2 className="section-title">
          2. Выберите 2 класса
          <span className="text-sm font-normal text-slate-400 ml-2">
            ({selected.length}/2 выбрано)
          </span>
        </h2>

        {loading && <div className="text-slate-400">Загрузка…</div>}
        {error && <div className="text-red-400">Ошибка: {error}</div>}

        {!loading && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {labels.map((l) => {
              const meta = LABEL_DISPLAY[l] ?? { ru: l, icon: '🎨' };
              const isSelected = selected.includes(l);
              const count = stats[l] ?? 0;
              return (
                <button
                  key={l}
                  onClick={() => toggle(l)}
                  className={`p-4 rounded-xl border-2 text-left transition ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-slate-700 bg-slate-900 hover:border-slate-500'
                  }`}
                >
                  <div className="text-3xl">{meta.icon}</div>
                  <div className="font-semibold text-white mt-2">{meta.ru}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {count} {pluralize(count, ['рисунок', 'рисунка', 'рисунков'])}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="section-card flex items-center justify-between">
        <div className="text-slate-400 text-sm">
          {canStart
            ? `Готово: ${nick.trim()} → ${selected.map((l) => LABEL_DISPLAY[l]?.ru ?? l).join(' vs ')}`
            : 'Заполните ник и выберите ровно 2 класса'}
        </div>
        <button onClick={handleStart} disabled={!canStart} className="btn-primary">
          Перейти к рисованию →
        </button>
      </div>

        <footer className="text-center py-8 border-t border-slate-800 mt-6 space-y-1">
          <div className="text-slate-400 text-xs">
            Курсовая работа · Визуализация алгоритмов машинного обучения
          </div>
          <div className="text-slate-600 text-[10px] uppercase tracking-[0.25em]">
            TensorFlow.js · React · FastAPI · PostgreSQL
          </div>
          <button
            onClick={() => navigate('/moderate')}
            className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
          >
            Модерация
          </button>
        </footer>
      </div>
    </div>
  );
}

function pluralize(n, forms) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}
