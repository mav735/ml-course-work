import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import ShapeCanvas from '../components/ShapeCanvas.jsx';
import ShapeToolbar from '../components/ShapeToolbar.jsx';
import DrawingsGallery from '../components/DrawingsGallery.jsx';
import { getDrawings, postDrawing } from '../api/client.js';
import { getLabelPair, getNickname } from '../utils/session.js';
import {
  CANVAS_SIZE,
  TARGET_SIZE,
  makeDefaultShape,
  rasterizeShapes,
  dataUrlToBase64,
} from '../utils/shapes.js';

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

export default function Draw() {
  const navigate = useNavigate();
  const nickname = getNickname();
  const labelPair = getLabelPair();

  useEffect(() => {
    if (!nickname || !labelPair) {
      navigate('/', { replace: true });
    }
  }, [nickname, labelPair, navigate]);

  const [activeIdx, setActiveIdx] = useState(0);
  const [shapes, setShapes] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [fill, setFill] = useState('#ffffff');
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Gallery state per label
  const [gallery, setGallery] = useState({});
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [galleryError, setGalleryError] = useState(null);

  const activeLabel = labelPair?.[activeIdx];

  const loadGallery = useCallback(async (label) => {
    setLoadingGallery(true);
    setGalleryError(null);
    try {
      const data = await getDrawings(label, 200);
      setGallery((prev) => ({ ...prev, [label]: data }));
    } catch (e) {
      setGalleryError(e.message);
    } finally {
      setLoadingGallery(false);
    }
  }, []);

  useEffect(() => {
    if (activeLabel) loadGallery(activeLabel);
  }, [activeLabel, loadGallery]);

  // Refresh preview whenever shapes change.
  useEffect(() => {
    if (shapes.length === 0) {
      setPreview(null);
      return;
    }
    const { dataUrl } = rasterizeShapes(shapes);
    setPreview(dataUrl);
  }, [shapes]);

  const snapshot = () => setHistory((h) => [...h, shapes]);

  const handleAddShape = (type) => {
    snapshot();
    const shape = makeDefaultShape(type, fill);
    setShapes((prev) => [...prev, shape]);
    setSelectedId(shape.id);
  };

  const handleClear = () => {
    if (shapes.length === 0) return;
    snapshot();
    setShapes([]);
    setSelectedId(null);
  };

  const handleDeleteSelected = () => {
    if (!selectedId) return;
    snapshot();
    setShapes((prev) => prev.filter((s) => s.id !== selectedId));
    setSelectedId(null);
  };

  const handleUndo = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setShapes(prev);
      setSelectedId(null);
      return h.slice(0, -1);
    });
  };

  const handleSetShapes = (updater) => {
    setShapes((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  };

  const handleSubmit = async () => {
    if (shapes.length === 0) {
      setSaveError('Нарисуйте хотя бы одну фигуру');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const { dataUrl } = rasterizeShapes(shapes);
      await postDrawing({
        label: activeLabel,
        nickname,
        shapes,
        png_base64: dataUrlToBase64(dataUrl),
      });
      setShapes([]);
      setHistory([]);
      setSelectedId(null);
      await loadGallery(activeLabel);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!nickname || !labelPair) return null;

  return (
    <div>
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-indigo-400 font-medium mb-0.5">
              Сессия рисования
            </div>
            <div className="text-lg text-slate-50 font-semibold tracking-tight">{nickname}</div>
          </div>
          <div className="flex gap-2">
            {labelPair.map((l, i) => (
              <button
                key={l}
                onClick={() => {
                  setActiveIdx(i);
                  setShapes([]);
                  setHistory([]);
                  setSelectedId(null);
                }}
                className={`px-4 py-2 rounded-sm text-sm font-medium ${
                  i === activeIdx ? 'tab-active' : 'tab-inactive'
                }`}
              >
                {LABEL_RU[l] ?? l}
                <span className="ml-2 text-xs opacity-70">
                  ({(gallery[l]?.length ?? 0)})
                </span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate('/')} className="btn-secondary">
              ← К выбору
            </button>
            <button onClick={() => navigate('/train')} className="btn-primary">
              К обучению →
            </button>
          </div>
        </div>
        <div className="accent-rule" />
      </header>

      <div className="max-w-5xl mx-auto px-6 py-6">

      <div className="section-card">
        <h2 className="section-title">
          Уже нарисовано: {LABEL_RU[activeLabel] ?? activeLabel}
        </h2>
        <DrawingsGallery
          drawings={gallery[activeLabel]}
          loading={loadingGallery}
          error={galleryError}
        />
      </div>

      <div className="section-card">
        <h2 className="section-title">
          Нарисуйте: {LABEL_RU[activeLabel] ?? activeLabel}
        </h2>
        <p className="text-slate-400 text-sm mb-4">
          Используйте простые геометрические формы. Кликните по фигуре, чтобы
          переместить, изменить размер или повернуть. Delete — удалить выделенную.
        </p>

        <ShapeToolbar
          onAdd={handleAddShape}
          fill={fill}
          setFill={setFill}
          onClear={handleClear}
          onUndo={handleUndo}
          canUndo={history.length > 0}
          onDeleteSelected={handleDeleteSelected}
          hasSelection={!!selectedId}
        />

        <div className="flex flex-wrap gap-6 mt-4 items-start">
          <div>
            <div className="text-xs text-slate-400 mb-2">Холст {CANVAS_SIZE}×{CANVAS_SIZE}</div>
            <ShapeCanvas
              shapes={shapes}
              setShapes={handleSetShapes}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
            />
          </div>

          <div>
            <div className="text-xs text-slate-400 mb-2">
              Превью {TARGET_SIZE}×{TARGET_SIZE} (то, что увидит модель)
            </div>
            <div
              className="bg-black rounded border border-slate-700"
              style={{ width: 192, height: 192 }}
            >
              {preview && (
                <img
                  src={preview}
                  alt="превью"
                  className="w-full h-full pixelated"
                />
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3 flex-wrap">
          <button
            onClick={handleSubmit}
            disabled={saving || shapes.length === 0}
            className="btn-primary"
          >
            {saving ? 'Сохраняю…' : `Сохранить как «${LABEL_RU[activeLabel] ?? activeLabel}»`}
          </button>
          {saveError && <span className="text-red-400 text-sm">{saveError}</span>}
        </div>
      </div>

      <footer className="text-center py-8 border-t border-slate-800 mt-6 space-y-1">
        <div className="text-slate-400 text-xs">
          Курсовая работа · Визуализация алгоритмов машинного обучения
        </div>
        <div className="text-slate-600 text-[10px] uppercase tracking-[0.25em]">
          TensorFlow.js · React · FastAPI · PostgreSQL
        </div>
      </footer>
      </div>
    </div>
  );
}
