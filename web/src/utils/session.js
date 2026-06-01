const NICK_KEY = 'cnnviz.nickname';
const LABELS_KEY = 'cnnviz.labels';

export function getNickname() {
  try {
    return localStorage.getItem(NICK_KEY) || '';
  } catch (_) {
    return '';
  }
}

export function setNickname(name) {
  try {
    localStorage.setItem(NICK_KEY, name);
  } catch (_) {}
}

export function getLabelPair() {
  try {
    const raw = localStorage.getItem(LABELS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 2) return parsed;
    return null;
  } catch (_) {
    return null;
  }
}

export function setLabelPair(pair) {
  try {
    localStorage.setItem(LABELS_KEY, JSON.stringify(pair));
  } catch (_) {}
}
