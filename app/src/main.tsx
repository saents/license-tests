import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Home, Skeleton } from './Home';
import { Quiz, type Mode } from './Quiz';
import { loadBank, useBank } from './data';
import { LANGS, strings } from './i18n';
import { LangSwitch, Segmented } from './ui';
import { update, useStore, type SetId } from './store';
import './styles.css';

function useHash() {
  const [h, setH] = useState(location.hash);
  useEffect(() => {
    const f = () => setH(location.hash);
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return h;
}

function App() {
  const lang = useStore((s) => s.lang);
  const set = useStore((s) => s.set);
  const hash = useHash();
  const bank = useBank(set, lang);
  const t = strings(lang);
  const [, route, mode, arg] = hash.replace(/^#\/?/, '/').split('/');

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t.title;
  }, [lang]);

  // Warm the other languages in the background once idle.
  useEffect(() => {
    if (!bank) return;
    const idle = (window as any).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 1500));
    idle(() => LANGS.forEach((l) => l.id !== lang && loadBank(set, l.id)));
  }, [!!bank, set]);

  const inQuiz = route === 'quiz';
  return (
    <>
      {!inQuiz && (
        <header class="topbar">
          <a class="brand" href="#/">
            <img src="./icon.svg" width="34" height="34" alt="" />
            <span>
              <b>{t.title}</b>
              <small>{t.subtitle}</small>
            </span>
          </a>
          <div class="switches">
            <Segmented
              value={set}
              options={[{ id: 'abc', label: 'A·B·C' }, { id: 'dt', label: 'D·T' }]}
              onChange={(v) => update(() => ({ set: v as SetId }))}
              label={t.category}
            />
            <LangSwitch />
          </div>
        </header>
      )}
      {!bank ? (
        <Skeleton />
      ) : inQuiz ? (
        // Keyed by route+set so a new route starts a fresh session; language switches keep the session.
        <Quiz key={`${mode}/${arg}/${set}`} mode={mode as Mode} arg={arg} bank={bank} set={set} t={t} />
      ) : (
        <Home bank={bank} set={set} t={t} />
      )}
    </>
  );
}


render(<App />, document.getElementById('app')!);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
