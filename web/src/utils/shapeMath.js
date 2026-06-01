// Geometry helpers for the custom-canvas drawing tool: hit-testing, bbox
// computation, coordinate transforms, and shape resize/rotate operations.
//
// All shapes live in the canvas's screen frame and additionally store a
// `rotation` (degrees). Each shape has a "local frame" centred at (shape.x,
// shape.y) and rotated by `shape.rotation`. The shape's own primitives
// (rect width/height, circle radius, etc.) live in that local frame.

function rotate(x, y, rad) {
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

export function localToScreen(lx, ly, shape) {
  const r = rotate(lx, ly, ((shape.rotation ?? 0) * Math.PI) / 180);
  return { x: shape.x + r.x, y: shape.y + r.y };
}

function screenToLocal(sx, sy, shape) {
  const r = rotate(sx - shape.x, sy - shape.y, -((shape.rotation ?? 0) * Math.PI) / 180);
  return { x: r.x, y: r.y };
}

/**
 * Local-frame axis-aligned bounding box of a shape's primitive geometry.
 * Returns { x, y, w, h } in the shape's local coordinates.
 */
export function getLocalBBox(shape) {
  switch (shape.type) {
    case 'rect':
      return { x: 0, y: 0, w: shape.width, h: shape.height };
    case 'circle':
      return { x: -shape.radius, y: -shape.radius, w: 2 * shape.radius, h: 2 * shape.radius };
    case 'ellipse':
      return { x: -shape.radiusX, y: -shape.radiusY, w: 2 * shape.radiusX, h: 2 * shape.radiusY };
    case 'triangle':
    case 'line': {
      const p = shape.points;
      let minX = p[0];
      let maxX = p[0];
      let minY = p[1];
      let maxY = p[1];
      for (let i = 2; i < p.length; i += 2) {
        if (p[i] < minX) minX = p[i];
        if (p[i] > maxX) maxX = p[i];
        if (p[i + 1] < minY) minY = p[i + 1];
        if (p[i + 1] > maxY) maxY = p[i + 1];
      }
      
      const w = Math.max(2, maxX - minX);
      const h = Math.max(2, maxY - minY);
      return { x: minX, y: minY, w, h };
    }
    default:
      return { x: 0, y: 0, w: 0, h: 0 };
  }
}

function pointInTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const sign = (x1, y1, x2, y2, x3, y3) => (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
  const d1 = sign(px, py, ax, ay, bx, by);
  const d2 = sign(px, py, bx, by, cx, cy);
  const d3 = sign(px, py, cx, cy, ax, ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}


export function hitTestShape(shape, sx, sy) {
  const local = screenToLocal(sx, sy, shape);
  switch (shape.type) {
    case 'rect':
      return local.x >= 0 && local.x <= shape.width && local.y >= 0 && local.y <= shape.height;
    case 'circle':
      return local.x * local.x + local.y * local.y <= shape.radius * shape.radius;
    case 'ellipse': {
      const ex = local.x / shape.radiusX;
      const ey = local.y / shape.radiusY;
      return ex * ex + ey * ey <= 1;
    }
    case 'triangle': {
      const p = shape.points;
      return pointInTriangle(local.x, local.y, p[0], p[1], p[2], p[3], p[4], p[5]);
    }
    case 'line': {
      const p = shape.points;
      return distToSegment(local.x, local.y, p[0], p[1], p[2], p[3]) <= 8;
    }
    default:
      return false;
  }
}

/**
 * Apply a resize, given start shape, the handle name (one of 'nw','n','ne',
 * 'e','se','s','sw','w'), and screen-space mouse delta. The opposite handle
 * is kept fixed in screen coordinates.
 */
export function resizeShape(startShape, handle, mdx, mdy) {
  const rad = -((startShape.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const ldx = mdx * cos - mdy * sin;
  const ldy = mdx * sin + mdy * cos;

  const oldBBox = getLocalBBox(startShape);
  const movesLeft = handle.includes('w');
  const movesRight = handle.includes('e');
  const movesTop = handle.includes('n');
  const movesBottom = handle.includes('s');

  let newX = oldBBox.x;
  let newY = oldBBox.y;
  let newW = oldBBox.w;
  let newH = oldBBox.h;

  if (movesLeft) {
    newX = oldBBox.x + ldx;
    newW = oldBBox.w - ldx;
  } else if (movesRight) {
    newW = oldBBox.w + ldx;
  }
  if (movesTop) {
    newY = oldBBox.y + ldy;
    newH = oldBBox.h - ldy;
  } else if (movesBottom) {
    newH = oldBBox.h + ldy;
  }

  const MIN = 6;
  if (newW < MIN) {
    if (movesLeft) newX = oldBBox.x + oldBBox.w - MIN;
    newW = MIN;
  }
  if (newH < MIN) {
    if (movesTop) newY = oldBBox.y + oldBBox.h - MIN;
    newH = MIN;
  }

  const newBBox = { x: newX, y: newY, w: newW, h: newH };
  const fitted = fitShapeToBBox(startShape, oldBBox, newBBox);
  return shiftShape(startShape, fitted.newShape, fitted.originShiftLocal);
}

function fitShapeToBBox(oldShape, oldBBox, newBBox) {
  switch (oldShape.type) {
    case 'rect': {
      return {
        newShape: { ...oldShape, width: newBBox.w, height: newBBox.h },
        originShiftLocal: { x: newBBox.x, y: newBBox.y },
      };
    }
    case 'circle': {
      const newR = Math.max(2, (newBBox.w + newBBox.h) / 4);
      const newCenterLocal = { x: newBBox.x + newBBox.w / 2, y: newBBox.y + newBBox.h / 2 };
      return {
        newShape: { ...oldShape, radius: newR },
        originShiftLocal: newCenterLocal,
      };
    }
    case 'ellipse': {
      const newRx = Math.max(2, newBBox.w / 2);
      const newRy = Math.max(2, newBBox.h / 2);
      const newCenterLocal = { x: newBBox.x + newBBox.w / 2, y: newBBox.y + newBBox.h / 2 };
      return {
        newShape: { ...oldShape, radiusX: newRx, radiusY: newRy },
        originShiftLocal: newCenterLocal,
      };
    }
    case 'triangle':
    case 'line': {
      const sx = oldBBox.w === 0 ? 1 : newBBox.w / oldBBox.w;
      const sy = oldBBox.h === 0 ? 1 : newBBox.h / oldBBox.h;
      const newPoints = oldShape.points.map((v, i) => {
        if (i % 2 === 0) return (v - oldBBox.x) * sx + newBBox.x;
        return (v - oldBBox.y) * sy + newBBox.y;
      });
      return {
        newShape: { ...oldShape, points: newPoints },
        originShiftLocal: { x: 0, y: 0 },
      };
    }
    default:
      return { newShape: { ...oldShape }, originShiftLocal: { x: 0, y: 0 } };
  }
}

function shiftShape(oldShape, newShape, originShiftLocal) {
  const r = rotate(originShiftLocal.x, originShiftLocal.y, ((oldShape.rotation ?? 0) * Math.PI) / 180);
  return { ...newShape, x: oldShape.x + r.x, y: oldShape.y + r.y };
}

export function rotateShape(startShape, startMouseX, startMouseY, curMouseX, curMouseY) {
  const bbox = getLocalBBox(startShape);
  const centerLocal = { x: bbox.x + bbox.w / 2, y: bbox.y + bbox.h / 2 };
  const center = localToScreen(centerLocal.x, centerLocal.y, startShape);

  const startAngle = Math.atan2(startMouseY - center.y, startMouseX - center.x);
  const newAngle = Math.atan2(curMouseY - center.y, curMouseX - center.x);
  const deltaDeg = ((newAngle - startAngle) * 180) / Math.PI;
  const newRotation = (startShape.rotation ?? 0) + deltaDeg;

  const radNew = (newRotation * Math.PI) / 180;
  const rotated = rotate(centerLocal.x, centerLocal.y, radNew);
  return {
    rotation: newRotation,
    x: center.x - rotated.x,
    y: center.y - rotated.y,
  };
}
