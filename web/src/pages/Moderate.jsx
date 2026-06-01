import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getModerationQueue,
  getModerationStats,
  moderateDrawing,
} from '../api/client.js';

const STORAGE_KEY = 'moderation_secret_key';
const SWIPE_LIMIT = 96;

const LABEL_RU = {
  apple: 'Яблоко',
  carrot: 'Морковь',
  star: 'Звезда',
  house: 'Дом',
  tree: 'Дерево',
  fish: 'Рыба',
  sun: 'Солнце',
  flower: 'Цветок',
};

export default function Moderate() {
  const [secret, setSecret] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [draftSecret, setDraftSecret] = useState(secret);
  const [authenticated, setAuthenticated] = useState(false);
  const [queue, setQueue] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragX, setDragX] = useState(0);
  const dragStartRef = useRef(null);

  const current = queue[0] || null;

  const loadQueue = useCallback(
    async (key = secret) => {
      if (!key) return;
      setLoading(true);
      setError(null);
      try {
        const [items, stats] = await Promise.all([
          getModerationQueue(key, 20),
          getModerationStats(key),
        ]);
        setQueue(items);
        setPendingCount(stats.pending);
        setAuthenticated(true);
        localStorage.setItem(STORAGE_KEY, key);
      } catch (e) {
        setAuthenticated(false);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [secret]
  );

  useEffect(() => {
    if (secret) loadQueue(secret);
  }, []);

  const handleLogin = async (event) => {
    event.preventDefault();
    const nextSecret = draftSecret.trim();
    setSecret(nextSecret);
    await loadQueue(nextSecret);
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSecret('');
    setDraftSecret('');
    setAuthenticated(false);
    setQueue([]);
    setPendingCount(0);
    setError(null);
  };

  const applyDecision = useCallback(
    async (decision) => {
      if (!current || actionLoading) return;
      setActionLoading(true);
      setError(null);
      try {
        await moderateDrawing(current.id, decision, secret);
        setQueue((items) => items.slice(1));
        setPendingCount((count) => Math.max(0, count - 1));
        setDragX(0);
        if (queue.length <= 4) {
          const [items, stats] = await Promise.all([
            getModerationQueue(secret, 20),
            getModerationStats(secret),
          ]);
          setQueue(items.filter((item) => item.id !== current.id));
          setPendingCount(stats.pending);
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setActionLoading(false);
      }
    },
    [actionLoading, current, queue.length, secret]
  );

  const cardStyle = useMemo(() => {
    const rotate = Math.max(-10, Math.min(10, dragX / 18));
    return {
      transform: `translateX(${dragX}px) rotate(${rotate}deg)`,
      transition: dragStartRef.current ? 'none' : 'transform 180ms ease',
    };
  }, [dragX]);

  const onPointerDown = (event) => {
    if (!current || actionLoading) return;
    dragStartRef.current = { pointerId: event.pointerId, x: event.clientX };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!dragStartRef.current || dragStartRef.current.pointerId !== event.pointerId) return;
    setDragX(event.clientX - dragStartRef.current.x);
  };

  const finishDrag = (event) => {
    if (!dragStartRef.current || dragStartRef.current.pointerId !== event.pointerId) return;
    const nextDrag = event.clientX - dragStartRef.current.x;
    dragStartRef.current = null;
    if (nextDrag >= SWIPE_LIMIT) {
      setDragX(180);
      applyDecision('approve');
      return;
    }
    if (nextDrag <= -SWIPE_LIMIT) {
      setDragX(-180);
      applyDecision('reject');
      return;
    }
    setDragX(0);
  };

  if (!authenticated) {
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-8 flex items-center justify-center">
        <form onSubmit={handleLogin} className="w-full max-w-sm section-card mb-0">
          <div className="text-[11px] uppercase tracking-[0.2em] text-indigo-400 font-medium">
            Модерация датасета
          </div>
          <h1 className="text-2xl font-semibold text-white mt-2">Секретный ключ</h1>
          <div className="mt-5">
            <label className="label-text" htmlFor="moderation-key">Ключ доступа</label>
            <input
              id="moderation-key"
              className="input-field w-full text-base"
              type="password"
              autoComplete="current-password"
              value={draftSecret}
              onChange={(event) => setDraftSecret(event.target.value)}
            />
          </div>
          {error && <div className="text-red-400 text-sm mt-3">Ошибка: {error}</div>}
          <button
            className="btn-primary w-full mt-5 py-3"
            disabled={loading || draftSecret.trim().length === 0}
          >
            {loading ? 'Проверяю...' : 'Войти'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-sm mx-auto min-h-screen px-4 py-4 flex flex-col">
        <header className="py-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-indigo-400 font-medium">
                Модерация
              </div>
              <h1 className="text-xl font-semibold text-white mt-1">Новые картинки</h1>
            </div>
            <button onClick={handleLogout} className="btn-secondary px-3 py-2">
              Выйти
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2">
              <div className="text-slate-500 text-xs">В очереди</div>
              <div className="text-lg font-semibold">{pendingCount}</div>
            </div>
            <button
              onClick={() => loadQueue(secret)}
              disabled={loading}
              className="btn-secondary h-full"
            >
              {loading ? 'Обновляю...' : 'Обновить'}
            </button>
          </div>
        </header>

        <section className="flex-1 flex flex-col justify-center py-4">
          {error && <div className="mb-3 text-red-400 text-sm">Ошибка: {error}</div>}

          {!current && !loading && (
            <div className="rounded-md border border-slate-800 bg-slate-900 px-5 py-8 text-center">
              <div className="text-lg font-semibold text-white">Очередь пуста</div>
              <div className="text-sm text-slate-400 mt-2">
                Новые рисунки появятся здесь после сохранения на странице рисования.
              </div>
            </div>
          )}

          {current && (
            <div className="relative h-[520px] max-h-[68vh]">
              <div className="absolute inset-0 rounded-md border border-slate-800 bg-slate-900" />
              <article
                className="absolute inset-0 rounded-md border border-slate-700 bg-slate-900 overflow-hidden shadow-xl touch-pan-y select-none"
                style={cardStyle}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
              >
                <div className="h-[72%] bg-black flex items-center justify-center">
                  <img
                    src={`data:image/png;base64,${current.png_base64}`}
                    alt={LABEL_RU[current.label] ?? current.label}
                    className="w-full h-full object-contain pixelated"
                    draggable="false"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-2xl font-semibold">
                        {LABEL_RU[current.label] ?? current.label}
                      </div>
                      <div className="text-sm text-slate-400 mt-1">{current.nickname}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500">ID</div>
                      <div className="font-mono text-sm">{current.id}</div>
                    </div>
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-colors ${
                        dragX > 0 ? 'bg-emerald-500' : dragX < 0 ? 'bg-red-500' : 'bg-slate-700'
                      }`}
                      style={{ width: `${Math.min(100, Math.abs(dragX))}%` }}
                    />
                  </div>
                </div>
              </article>
            </div>
          )}
        </section>

        <footer className="grid grid-cols-2 gap-3 pb-4">
          <button
            onClick={() => applyDecision('reject')}
            disabled={!current || actionLoading}
            className="bg-red-950 hover:bg-red-900 disabled:bg-slate-800 disabled:text-slate-500 border border-red-900 disabled:border-slate-800 text-red-100 font-semibold rounded-sm py-4 transition-colors"
          >
            Отклонить
          </button>
          <button
            onClick={() => applyDecision('approve')}
            disabled={!current || actionLoading}
            className="bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-500 border border-emerald-600 disabled:border-slate-800 text-white font-semibold rounded-sm py-4 transition-colors"
          >
            Принять
          </button>
        </footer>
      </div>
    </main>
  );
}
