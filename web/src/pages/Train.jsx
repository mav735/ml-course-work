import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as tf from '@tensorflow/tfjs';

import ModelConfig from '../components/ModelConfig.jsx';
import TrainingPanel from '../components/TrainingPanel.jsx';
import ActivationMaps from '../components/ActivationMaps.jsx';
import TopKChannels from '../components/TopKChannels.jsx';
import GradCAMView from '../components/GradCAMView.jsx';

import { buildDatasetFromAPI } from '../utils/dataset.js';
import { buildModel, trainModel, countParams, DEFAULT_LAYERS } from '../utils/model.js';
import { getLabelPair, getNickname } from '../utils/session.js';

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

export default function Train() {
  const navigate = useNavigate();
  const labelPair = getLabelPair();
  const nickname = getNickname();

  useEffect(() => {
    if (!labelPair) navigate('/', { replace: true });
  }, [labelPair, navigate]);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [datasetReady, setDatasetReady] = useState(false);
  const [datasetCounts, setDatasetCounts] = useState(null);
  const [datasetError, setDatasetError] = useState(null);
  const datasetRef = useRef(null);
  const [vizExamples, setVizExamples] = useState(null);

  const [layers, setLayers] = useState(DEFAULT_LAYERS.map((l) => ({ ...l })));
  const [paramCount, setParamCount] = useState(null);
  const modelRef = useRef(null);

  const [epochs, setEpochs] = useState(10);
  const [lr, setLr] = useState(0.001);
  const [batchSize, setBatchSize] = useState(16);
  const [training, setTraining] = useState(false);
  const [trainingHistory, setTrainingHistory] = useState([]);
  const [trained, setTrained] = useState(false);

  const [vizTab, setVizTab] = useState('activations');

  useEffect(() => {
    const m = buildModel(layers);
    const dummy = tf.zeros([1, 64, 64, 1]);
    m.predict(dummy);
    dummy.dispose();
    setParamCount(countParams(m));
    m.dispose();
  }, [layers]);

  const labelNames = labelPair ? labelPair.map((l) => LABEL_RU[l] ?? l) : ['Класс A', 'Класс B'];

  const handleLoadDataset = useCallback(async () => {
    if (!labelPair) return;
    setLoading(true);
    setProgress(0);
    setProgressMsg('');
    setDatasetReady(false);
    setDatasetError(null);
    setTrained(false);
    setTrainingHistory([]);

    try {
      const ds = await buildDatasetFromAPI(labelPair[0], labelPair[1], (pct, msg) => {
        setProgress(pct);
        setProgressMsg(msg ?? '');
      });
      datasetRef.current = ds;
      setVizExamples(ds.vizExamples);
      setDatasetCounts(ds.counts);
      setDatasetReady(true);
    } catch (e) {
      console.error(e);
      setDatasetError(e.message);
    } finally {
      setLoading(false);
    }
  }, [labelPair]);

  const handleTrain = useCallback(async () => {
    if (!datasetRef.current) return;
    setTraining(true);
    setTrainingHistory([]);
    setTrained(false);

    try {
      if (modelRef.current) {
        modelRef.current.dispose();
        modelRef.current = null;
      }
      const model = buildModel(layers);
      const dummy = tf.zeros([1, 64, 64, 1]);
      model.predict(dummy);
      dummy.dispose();
      modelRef.current = model;

      const { pixels, labels, N } = datasetRef.current;

      await trainModel(
        model,
        pixels,
        labels,
        N,
        { lr, epochs, batchSize },
        async (epoch, logs, history) => {
          setTrainingHistory([...history]);
        }
      );

      setTrained(true);
    } catch (e) {
      console.error('Training failed:', e);
      alert('Ошибка обучения: ' + e.message);
    } finally {
      setTraining(false);
    }
  }, [layers, lr, epochs, batchSize]);

  const VIZ_TABS = [
    { id: 'activations', label: 'Активации слоёв' },
    { id: 'topk', label: 'Top-K каналов' },
    { id: 'gradcam', label: 'Grad-CAM' },
  ];

  if (!labelPair) return null;

  return (
    <div>
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-indigo-400 font-medium mb-0.5">
              Обучение · {labelNames[0]} vs {labelNames[1]}
            </div>
            <h1 className="text-xl font-semibold text-slate-50 tracking-tight">
              CNN-классификатор и визуализация
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">
              {nickname ? `Сессия: ${nickname}` : 'Без никнейма'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/draw')} className="btn-secondary">← К рисованию</button>
            <button onClick={() => navigate('/')} className="btn-secondary">К выбору</button>
          </div>
        </div>
        <div className="accent-rule" />
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="section-card">
          <h2 className="section-title">1. Датасет (рисунки из БД)</h2>
          <p className="text-slate-400 text-sm mb-4">
            Все рисунки, которые загрузили вы и другие пользователи под выбранными лейблами,
            будут использованы как обучающая выборка.
          </p>

          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={handleLoadDataset}
              disabled={loading}
              className="btn-primary"
            >
              {loading
                ? `Загружаю… ${progress}%`
                : datasetReady
                ? 'Перезагрузить'
                : 'Загрузить датасет'}
            </button>
            {datasetReady && datasetCounts && (
              <div className="text-sm text-emerald-400">
                ✓ Готово:{' '}
                {Object.entries(datasetCounts)
                  .map(([k, v]) => `${LABEL_RU[k] ?? k} = ${v}`)
                  .join(', ')}
              </div>
            )}
          </div>

          {loading && (
            <div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-indigo-500 h-2 rounded-full transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">{progressMsg}</p>
            </div>
          )}

          {datasetError && (
            <div className="text-red-400 text-sm mt-2">Ошибка: {datasetError}</div>
          )}
        </div>

        <ModelConfig layers={layers} setLayers={setLayers} paramCount={paramCount} />

        <TrainingPanel
          epochs={epochs}
          setEpochs={setEpochs}
          lr={lr}
          setLr={setLr}
          batchSize={batchSize}
          setBatchSize={setBatchSize}
          onTrain={handleTrain}
          training={training}
          trainingHistory={trainingHistory}
          datasetReady={datasetReady}
        />

        <div className={`section-card ${!trained ? 'opacity-50 pointer-events-none' : ''}`}>
          <h2 className="section-title">
            Визуализации
            {!trained && (
              <span className="text-sm font-normal text-slate-500 ml-2">
                (сначала обучите модель)
              </span>
            )}
          </h2>

          {trained && (
            <>
              <div className="flex gap-2 mb-6 flex-wrap">
                {VIZ_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setVizTab(tab.id)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                      vizTab === tab.id ? 'tab-active' : 'tab-inactive'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {vizTab === 'activations' && modelRef.current && vizExamples && (
                <ActivationMaps
                  model={modelRef.current}
                  vizExamples={vizExamples}
                  labelNames={labelNames}
                />
              )}
              {vizTab === 'topk' && modelRef.current && vizExamples && (
                <TopKChannels
                  model={modelRef.current}
                  vizExamples={vizExamples}
                  labelNames={labelNames}
                />
              )}
              {vizTab === 'gradcam' && modelRef.current && vizExamples && (
                <GradCAMView
                  model={modelRef.current}
                  vizExamples={vizExamples}
                  labelNames={labelNames}
                />
              )}
            </>
          )}
        </div>

        <footer className="text-center py-8 border-t border-slate-800 mt-6 space-y-1">
          <div className="text-slate-400 text-xs">
            Курсовая работа · Визуализация алгоритмов машинного обучения
          </div>
          <div className="text-slate-600 text-[10px] uppercase tracking-[0.25em]">
            TensorFlow.js · React · FastAPI · PostgreSQL
          </div>
        </footer>
      </main>
    </div>
  );
}
