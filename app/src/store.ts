import { useEffect, useState } from 'preact/hooks';
import type { Lang } from './i18n';

export type SetId = 'abc' | 'dt';
/** Per-question stats: c = times correct, w = times wrong, l = last result (1 correct, 0 wrong). */
export type Stat = { c: number; w: number; l: 0 | 1 };
export type ExamRecord = { set: SetId; ok: number; total: number; passed: boolean; ts: number };

type State = {
  lang: Lang;
  set: SetId;
  stats: Record<string, Stat>;
  marks: Record<string, 1>;
  pos: Record<string, number>;
  exams: ExamRecord[];
};

const KEY = 'viv-quiz:v1';
const detectLang = (): Lang => {
  const l = (navigator.language || '').slice(0, 2);
  return l === 'ru' ? 'ru' : l === 'en' ? 'en' : 'hy';
};
const initial: State = { lang: detectLang(), set: 'abc', stats: {}, marks: {}, pos: {}, exams: [] };

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...initial, ...JSON.parse(raw) };
  } catch { /* storage unavailable */ }
  return { ...initial };
}

let state = load();
const subs = new Set<() => void>();
let saveTimer = 0;

function persist() {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota / private mode */ }
  }, 150);
}

export const getState = () => state;
export function update(fn: (s: State) => Partial<State>) {
  state = { ...state, ...fn(state) };
  persist();
  subs.forEach((f) => f());
}
export function useStore<T>(sel: (s: State) => T): T {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    subs.add(f);
    return () => { subs.delete(f); };
  }, []);
  return sel(state);
}

export const qid = (set: SetId, g: number, n: number) => `${set}:${g}:${n}`;

export function record(id: string, ok: boolean) {
  update((s) => {
    const prev = s.stats[id] ?? { c: 0, w: 0, l: 0 };
    return { stats: { ...s.stats, [id]: { c: prev.c + (ok ? 1 : 0), w: prev.w + (ok ? 0 : 1), l: ok ? 1 : 0 } } };
  });
}
export function toggleMark(id: string) {
  update((s) => {
    const marks = { ...s.marks };
    if (marks[id]) delete marks[id]; else marks[id] = 1;
    return { marks };
  });
}
export const setPos = (key: string, i: number) => update((s) => ({ pos: { ...s.pos, [key]: i } }));
export const addExam = (r: ExamRecord) => update((s) => ({ exams: [r, ...s.exams].slice(0, 20) }));
export const resetAll = () => update((s) => ({ ...initial, lang: s.lang, set: s.set }));

// Flush pending writes when the tab is hidden/closed.
addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    clearTimeout(saveTimer);
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }
});
