const BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '');

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) {
        detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
      }
    } catch (_) {}
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

export function getLabels() {
  return request('/labels');
}

export function getStats() {
  return request('/drawings/stats');
}

export function getDrawings(label, limit = 500) {
  const url = `/drawings?label=${encodeURIComponent(label)}&limit=${limit}`;
  return request(url);
}

export function postDrawing({ label, nickname, shapes, png_base64 }) {
  return request('/drawings', {
    method: 'POST',
    body: JSON.stringify({ label, nickname, shapes, png_base64 }),
  });
}

function moderationHeaders(secretKey) {
  return { 'X-Secret-Key': secretKey };
}

export function getModerationQueue(secretKey, limit = 20) {
  return request(`/drawings/moderation?limit=${limit}`, {
    headers: moderationHeaders(secretKey),
  });
}

export function getModerationStats(secretKey) {
  return request('/drawings/moderation/stats', {
    headers: moderationHeaders(secretKey),
  });
}

export function moderateDrawing(id, decision, secretKey) {
  return request(`/drawings/${id}/moderation`, {
    method: 'PATCH',
    headers: moderationHeaders(secretKey),
    body: JSON.stringify({ decision }),
  });
}
