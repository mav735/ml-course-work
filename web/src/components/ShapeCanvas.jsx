import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';

import { CANVAS_SIZE, drawShape } from '../utils/shapes.js';
import {
  hitTestShape,
  getLocalBBox,
  localToScreen,
  resizeShape,
  rotateShape,
} from '../utils/shapeMath.js';


export default function ShapeCanvas({ shapes, setShapes, selectedId, setSelectedId }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const [hoverId, setHoverId] = useState(null);

  // ---- Render shapes onto the canvas whenever shapes change ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    for (const s of shapes) drawShape(ctx, s, 1);
  }, [shapes]);

  const selectedShape = useMemo(
    () => shapes.find((s) => s.id === selectedId) ?? null,
    [shapes, selectedId]
  );

  const cursor = useMemo(() => {
    if (drag?.mode === 'rotate') return 'grabbing';
    if (drag?.mode === 'move') return 'grabbing';
    if (hoverId) return 'move';
    return 'default';
  }, [drag, hoverId]);

  const onCanvasMouseDown = (e) => {
    if (e.button !== 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Top-most first.
    for (let i = shapes.length - 1; i >= 0; i--) {
      if (hitTestShape(shapes[i], x, y)) {
        const s = shapes[i];
        if (selectedId !== s.id) setSelectedId(s.id);
        setDrag({
          mode: 'move',
          shapeId: s.id,
          startMouse: { x: e.clientX, y: e.clientY },
          startShape: { ...s },
        });
        e.preventDefault();
        return;
      }
    }
    setSelectedId(null);
  };

  const onCanvasMouseMove = (e) => {
    if (drag) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let id = null;
    for (let i = shapes.length - 1; i >= 0; i--) {
      if (hitTestShape(shapes[i], x, y)) {
        id = shapes[i].id;
        break;
      }
    }
    if (id !== hoverId) setHoverId(id);
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (ev) => {
      const mdx = ev.clientX - drag.startMouse.x;
      const mdy = ev.clientY - drag.startMouse.y;

      let patch;
      if (drag.mode === 'move') {
        patch = { x: drag.startShape.x + mdx, y: drag.startShape.y + mdy };
      } else if (drag.mode === 'resize') {
        patch = resizeShape(drag.startShape, drag.handle, mdx, mdy);
      } else if (drag.mode === 'rotate') {
        const rect = containerRef.current.getBoundingClientRect();
        const startMx = drag.startMouse.x - rect.left;
        const startMy = drag.startMouse.y - rect.top;
        const curMx = ev.clientX - rect.left;
        const curMy = ev.clientY - rect.top;
        patch = rotateShape(drag.startShape, startMx, startMy, curMx, curMy);
      }
      setShapes((prev) => prev.map((s) => (s.id === drag.shapeId ? { ...s, ...patch } : s)));
    };
    const onUp = () => setDrag(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [drag, setShapes]);

  const startResize = useCallback(
    (handle) => (e) => {
      if (!selectedShape) return;
      e.preventDefault();
      e.stopPropagation();
      setDrag({
        mode: 'resize',
        shapeId: selectedShape.id,
        handle,
        startMouse: { x: e.clientX, y: e.clientY },
        startShape: { ...selectedShape },
      });
    },
    [selectedShape]
  );

  const startRotate = useCallback(
    (e) => {
      if (!selectedShape) return;
      e.preventDefault();
      e.stopPropagation();
      setDrag({
        mode: 'rotate',
        shapeId: selectedShape.id,
        startMouse: { x: e.clientX, y: e.clientY },
        startShape: { ...selectedShape },
      });
    },
    [selectedShape]
  );

  const onKeyDown = (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
      setShapes((prev) => prev.filter((s) => s.id !== selectedId));
      setSelectedId(null);
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="focus:outline-none"
      style={{
        position: 'relative',
        width: CANVAS_SIZE,
        height: CANVAS_SIZE,
        background: '#000',
        borderRadius: 8,
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        onMouseDown={onCanvasMouseDown}
        onMouseMove={onCanvasMouseMove}
        onMouseLeave={() => setHoverId(null)}
        style={{ display: 'block', cursor, borderRadius: 8 }}
      />
      {selectedShape && (
        <SelectionOverlay
          shape={selectedShape}
          onResizeStart={startResize}
          onRotateStart={startRotate}
        />
      )}
    </div>
  );
}


const HANDLE_DEFS = [
  { name: 'nw', cursor: 'nwse-resize' },
  { name: 'n', cursor: 'ns-resize' },
  { name: 'ne', cursor: 'nesw-resize' },
  { name: 'e', cursor: 'ew-resize' },
  { name: 'se', cursor: 'nwse-resize' },
  { name: 's', cursor: 'ns-resize' },
  { name: 'sw', cursor: 'nesw-resize' },
  { name: 'w', cursor: 'ew-resize' },
];

const HANDLE_SIZE = 14;
const ROTATE_OFFSET = 30;

function handleLocalPos(name, bbox) {
  switch (name) {
    case 'nw': return { x: bbox.x, y: bbox.y };
    case 'n':  return { x: bbox.x + bbox.w / 2, y: bbox.y };
    case 'ne': return { x: bbox.x + bbox.w, y: bbox.y };
    case 'e':  return { x: bbox.x + bbox.w, y: bbox.y + bbox.h / 2 };
    case 'se': return { x: bbox.x + bbox.w, y: bbox.y + bbox.h };
    case 's':  return { x: bbox.x + bbox.w / 2, y: bbox.y + bbox.h };
    case 'sw': return { x: bbox.x, y: bbox.y + bbox.h };
    case 'w':  return { x: bbox.x, y: bbox.y + bbox.h / 2 };
    default:   return { x: 0, y: 0 };
  }
}

function SelectionOverlay({ shape, onResizeStart, onRotateStart }) {
  const bbox = getLocalBBox(shape);

  const boxCorners = [
    { x: bbox.x, y: bbox.y },
    { x: bbox.x + bbox.w, y: bbox.y },
    { x: bbox.x + bbox.w, y: bbox.y + bbox.h },
    { x: bbox.x, y: bbox.y + bbox.h },
  ].map((p) => localToScreen(p.x, p.y, shape));

  const handles = HANDLE_DEFS.map((h) => {
    const local = handleLocalPos(h.name, bbox);
    const screen = localToScreen(local.x, local.y, shape);
    return { ...h, screen };
  });
  const topMid = { x: bbox.x + bbox.w / 2, y: bbox.y };
  const rotateLocal = { x: topMid.x, y: topMid.y - ROTATE_OFFSET };
  const topMidScreen = localToScreen(topMid.x, topMid.y, shape);
  const rotateScreen = localToScreen(rotateLocal.x, rotateLocal.y, shape);

  const polyPoints = boxCorners.map((c) => `${c.x},${c.y}`).join(' ');

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: CANVAS_SIZE,
        height: CANVAS_SIZE,
        pointerEvents: 'none',
      }}
    >
      <svg
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}
      >
        <polygon
          points={polyPoints}
          fill="none"
          stroke="#4f7bb0"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        <line
          x1={topMidScreen.x}
          y1={topMidScreen.y}
          x2={rotateScreen.x}
          y2={rotateScreen.y}
          stroke="#4f7bb0"
          strokeWidth="1.5"
        />
      </svg>

      <div
        onMouseDown={onRotateStart}
        title="Повернуть"
        style={{
          position: 'absolute',
          left: rotateScreen.x - 9,
          top: rotateScreen.y - 9,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#141418',
          border: '2px solid #4f7bb0',
          cursor: 'grab',
          pointerEvents: 'auto',
          boxSizing: 'border-box',
        }}
      />

      {handles.map((h) => (
        <div
          key={h.name}
          onMouseDown={onResizeStart(h.name)}
          title={`Изменить размер (${h.name})`}
          style={{
            position: 'absolute',
            left: h.screen.x - HANDLE_SIZE / 2,
            top: h.screen.y - HANDLE_SIZE / 2,
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            background: '#141418',
            border: '2px solid #4f7bb0',
            borderRadius: 3,
            cursor: h.cursor,
            pointerEvents: 'auto',
            boxSizing: 'border-box',
          }}
        />
      ))}
    </div>
  );
}
