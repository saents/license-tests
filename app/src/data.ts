import { useEffect, useState } from 'preact/hooks';
import type { Lang } from './i18n';
import type { SetId } from './store';

/** n = number within group, q = text, o = options, a = correct option (1-based), i/w/h = image file + size. */
export type Question = { n: number; q: string; o: string[]; a: number; i?: string; w?: number; h?: number };
export type Group = { g: number; qs: Question[] };
export type Bank = Group[];

const cache = new Map<string, Promise<Bank>>();

export function loadBank(set: SetId, lang: Lang): Promise<Bank> {
  const key = `${set}.${lang}`;
  let p = cache.get(key);
  if (!p) {
    p = fetch(`data/${key}.json`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<Bank>;
    });
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

export function useBank(set: SetId, lang: Lang): Bank | null {
  const [bank, setBank] = useState<{ key: string; b: Bank } | null>(null);
  const key = `${set}.${lang}`;
  useEffect(() => {
    let alive = true;
    loadBank(set, lang).then((b) => alive && setBank({ key, b }));
    return () => { alive = false; };
  }, [key]);
  // While another language loads, keep showing the previous one of the same set (keeps quiz sessions alive).
  return bank && bank.key.startsWith(set + '.') ? bank.b : null;
}

export const imgUrl = (f: string) => `data/img/${f}`;

/** Warm the browser cache so the next question's image shows instantly. */
export function preloadImage(f?: string) {
  if (!f) return;
  const img = new Image();
  img.decoding = 'async';
  img.src = imgUrl(f);
}

export function shuffle<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
