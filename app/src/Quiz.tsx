import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { imgUrl, preloadImage, shuffle, type Bank, type Question } from './data';
import type { Strings } from './i18n';
import { LangSwitch } from './ui';
import { addExam, getState, qid, record, setPos, toggleMark, useStore, type SetId } from './store';

export type Mode = 'exam' | 'group' | 'mistakes' | 'bookmarks' | 'marathon';
type Ref = { g: number; n: number };
type Props = { mode: Mode; arg?: string; bank: Bank; set: SetId; t: Strings };

const EXAM_PER_GROUP = 2; // 10 groups × 2 = 20 questions
const EXAM_MINUTES = 30;
const EXAM_MAX_WRONG = 2;
const AUTO_NEXT_MS = 650;

function buildRefs(mode: Mode, arg: string | undefined, bank: Bank, set: SetId): Ref[] {
  const { stats, marks } = getState();
  const all = bank.flatMap((g) => g.qs.map((q) => ({ g: g.g, n: q.n })));
  const id = (r: Ref) => qid(set, r.g, r.n);
  switch (mode) {
    case 'exam':
      return bank.flatMap((g) => shuffle(g.qs).slice(0, EXAM_PER_GROUP).map((q) => ({ g: g.g, n: q.n })));
    case 'group': {
      const g = bank.find((x) => x.g === Number(arg)) ?? bank[0];
      const refs = g.qs.map((q) => ({ g: g.g, n: q.n }));
      return arg?.endsWith('s') ? shuffle(refs) : refs;
    }
    case 'mistakes':
      return shuffle(all.filter((r) => stats[id(r)]?.l === 0));
    case 'bookmarks':
      return all.filter((r) => marks[id(r)]);
    case 'marathon': {
      const fresh = all.filter((r) => !stats[id(r)]);
      const wrong = all.filter((r) => stats[id(r)]?.l === 0);
      const rest = all.filter((r) => stats[id(r)]?.l === 1);
      return [...shuffle(wrong), ...shuffle(fresh), ...shuffle(rest)];
    }
  }
}

export function Quiz({ mode, arg, bank, set, t }: Props) {
  const isExam = mode === 'exam';
  const groupNo = mode === 'group' ? parseInt(arg ?? '1', 10) : 0;
  const posKey = `${set}:${groupNo}`;

  const lookup = useMemo(() => {
    const m = new Map<string, Question>();
    for (const g of bank) for (const q of g.qs) m.set(`${g.g}:${q.n}`, q);
    return m;
  }, [bank]);

  const [session, setSession] = useState(() => newSession());
  function newSession() {
    const refs = buildRefs(mode, arg, bank, set);
    const saved = mode === 'group' && !arg?.endsWith('s') ? getState().pos[posKey] ?? 0 : 0;
    return {
      refs,
      idx: saved < refs.length ? saved : 0,
      answers: {} as Record<number, number>,
      done: false,
      timeUp: false,
      deadline: isExam ? Date.now() + EXAM_MINUTES * 60_000 : 0,
      key: Math.random(),
    };
  }
  const { refs, idx, answers, done } = session;
  const ref = refs[idx];
  const q = ref ? lookup.get(`${ref.g}:${ref.n}`) : undefined;
  const id = ref ? qid(set, ref.g, ref.n) : '';
  const marked = useStore((s) => !!s.marks[id]);
  const chosen = answers[idx];
  const [zoom, setZoom] = useState(false);
  const autoTimer = useRef(0);

  const go = useCallback(
    (i: number) => {
      clearTimeout(autoTimer.current);
      setSession((s) => {
        const next = Math.max(0, Math.min(s.refs.length - 1, i));
        if (mode === 'group') setPos(posKey, next);
        return { ...s, idx: next };
      });
      scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    },
    [mode, posKey],
  );

  const finish = useCallback(
    (timeUp = false) => {
      clearTimeout(autoTimer.current);
      setSession((s) => {
        if (s.done) return s;
        if (isExam) {
          let ok = 0;
          s.refs.forEach((r, i) => {
            const qq = lookup.get(`${r.g}:${r.n}`)!;
            const a = s.answers[i];
            if (a === qq.a) ok++;
            if (a != null) record(qid(set, r.g, r.n), a === qq.a);
          });
          addExam({ set, ok, total: s.refs.length, passed: s.refs.length - ok <= EXAM_MAX_WRONG, ts: Date.now() });
        }
        if (mode === 'group') setPos(posKey, 0);
        return { ...s, done: true, timeUp };
      });
      scrollTo({ top: 0 });
    },
    [isExam, lookup, set, mode, posKey],
  );

  const choose = useCallback(
    (opt: number) => {
      if (!q || done) return;
      if (!isExam && chosen != null) return; // practice: first answer counts
      setSession((s) => ({ ...s, answers: { ...s.answers, [s.idx]: opt } }));
      if (isExam) return;
      const ok = opt === q.a;
      record(id, ok);
      if (ok && !q.x) { // with an explanation to read, wait for the user to move on
        autoTimer.current = window.setTimeout(() => {
          if (idx < refs.length - 1) go(idx + 1);
        }, AUTO_NEXT_MS);
      }
    },
    [q, done, isExam, chosen, id, idx, refs.length, go],
  );

  // Preload the next two images.
  useEffect(() => {
    for (const r of refs.slice(idx + 1, idx + 3)) preloadImage(lookup.get(`${r.g}:${r.n}`)?.i);
  }, [idx, refs, lookup]);

  useEffect(() => () => clearTimeout(autoTimer.current), []);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || done) return;
      if (zoom) { if (e.key === 'Escape') setZoom(false); return; }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= (q?.o.length ?? 0)) { choose(n); return; }
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (idx < refs.length - 1) go(idx + 1);
        else if (isExam || chosen != null) finish();
      } else if (e.key === 'ArrowLeft') go(idx - 1);
      else if (e.key.toLowerCase() === 'b' && id) toggleMark(id);
      else if (e.key === 'Escape') location.hash = '#/';
      else return;
      e.preventDefault();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [q, choose, go, finish, idx, refs.length, isExam, chosen, id, done, zoom]);

  const title =
    mode === 'exam' ? t.exam : mode === 'group' ? `${t.group} ${groupNo}` : mode === 'mistakes' ? t.mistakes : mode === 'bookmarks' ? t.bookmarks : t.marathon;

  if (!refs.length) {
    return (
      <main class="quiz">
        <QuizBar title={title} />
        <div class="card empty">
          <p>{t.empty}</p>
          <a class="btn primary" href="#/">{t.home}</a>
        </div>
      </main>
    );
  }

  if (done) {
    return (
      <Results
        t={t} title={title} isExam={isExam} timeUp={session.timeUp} refs={refs} answers={answers} lookup={lookup}
        onRetry={() => setSession(newSession())}
      />
    );
  }
  if (!q) return null;

  const answeredCount = Object.keys(answers).length;
  const reveal = !isExam && chosen != null;
  const last = idx === refs.length - 1;
  const correctSoFar = isExam ? 0 : Object.entries(answers).filter(([i, a]) => {
    const r = refs[+i]; return lookup.get(`${r.g}:${r.n}`)?.a === a;
  }).length;

  return (
    <main class="quiz" key={session.key}>
      <QuizBar title={title}>
        {isExam && <Timer deadline={session.deadline} onExpire={() => finish(true)} />}
        {mode === 'group' && (
          <a class="icon-btn" title={t.shuffle} href={arg?.endsWith('s') ? `#/quiz/group/${groupNo}` : `#/quiz/group/${groupNo}s`}>
            {arg?.endsWith('s') ? '↺' : '⤨'}
          </a>
        )}
        <button class={`icon-btn star ${marked ? 'on' : ''}`} title={t.bookmarks} onClick={() => toggleMark(id)} aria-pressed={marked}>
          {marked ? '★' : '☆'}
        </button>
      </QuizBar>

      <div class="progress">
        <div class="progress-info">
          <span>
            {t.question} <b>{idx + 1}</b> {t.of} {refs.length}
          </span>
          <span class="muted">
            {isExam ? `${answeredCount}/${refs.length}` : (
              <>
                <span class="ok-text">✓ {correctSoFar}</span> <span class="bad-text">✗ {answeredCount - correctSoFar}</span>
              </>
            )}
            <span class="tag">{t.group} {ref.g} · #{ref.n}</span>
          </span>
        </div>
        {isExam ? (
          <div class="dots">
            {refs.map((_, i) => (
              <button
                key={i}
                class={`dotbtn ${i === idx ? 'cur' : ''} ${answers[i] != null ? 'done' : ''}`}
                onClick={() => go(i)}
                aria-label={`${t.question} ${i + 1}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        ) : (
          <div class="bar thin">
            <i class="ok" style={{ width: `${((idx + 1) / refs.length) * 100}%` }} />
          </div>
        )}
      </div>

      <QuestionView q={q} chosen={chosen} reveal={reveal} onChoose={choose} onZoom={() => setZoom(true)} />

      {reveal && (
        <div class={`feedback ${chosen === q.a ? 'ok' : 'bad'}`} role="status">
          {chosen === q.a ? `✓ ${t.correct}` : `✗ ${t.wrong} — ${t.answer}: ${q.a}`}
        </div>
      )}

      <nav class="navbar">
        <button class="btn" onClick={() => go(idx - 1)} disabled={idx === 0}>
          ‹ {t.prev}
        </button>
        {last ? (
          <button class="btn primary" onClick={() => finish()} disabled={!isExam && chosen == null}>
            {t.finish}
          </button>
        ) : (
          <button class={`btn ${reveal || chosen != null ? 'primary' : ''}`} onClick={() => go(idx + 1)}>
            {t.next} ›
          </button>
        )}
      </nav>
      {isExam && !last && answeredCount === refs.length && (
        <button class="btn primary wide" onClick={() => finish()}>
          {t.finish}
        </button>
      )}

      {zoom && q.i && (
        <div class="lightbox" onClick={() => setZoom(false)}>
          <img src={imgUrl(q.i)} alt="" />
        </div>
      )}
    </main>
  );
}

function QuizBar({ title, children }: { title: string; children?: preact.ComponentChildren }) {
  return (
    <header class="quizbar">
      <a class="icon-btn" href="#/" aria-label="Home">‹</a>
      <h1>{title}</h1>
      <div class="quizbar-actions">{children}</div>
      <div class="quizbar-lang"><LangSwitch /></div>
    </header>
  );
}

function QuestionView({ q, chosen, reveal, onChoose, onZoom }: {
  q: Question; chosen?: number; reveal: boolean; onChoose: (n: number) => void; onZoom?: () => void;
}) {
  const numeric = q.o.every((o) => /^\d+$/.test(o.trim()));
  return (
    <article class="card question">
      <h2 class="qtext">{q.q}</h2>
      {q.i && (
        <button class="qimg" onClick={onZoom} style={{ aspectRatio: `${q.w} / ${q.h}` }}>
          <img src={imgUrl(q.i)} width={q.w} height={q.h} alt="" decoding="async" />
        </button>
      )}
      <ol class={`opts ${numeric ? 'numeric' : ''}`}>
        {q.o.map((o, i) => {
          const n = i + 1;
          let cls = '';
          if (reveal) {
            if (n === q.a) cls = 'correct';
            else if (n === chosen) cls = 'wrong';
            else cls = 'dim';
          } else if (n === chosen) cls = 'picked';
          return (
            <li key={n}>
              <button class={`opt ${cls}`} onClick={() => onChoose(n)} disabled={reveal}>
                <span class="opt-n">{n}</span>
                {!numeric && <span class="opt-t">{o}</span>}
              </button>
            </li>
          );
        })}
      </ol>
      {reveal && q.x && (
        <p class="explain">
          <span aria-hidden="true">💡</span> {q.x}
        </p>
      )}
    </article>
  );
}

function Timer({ deadline, onExpire }: { deadline: number; onExpire: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(h);
  }, []);
  const left = Math.max(0, deadline - now);
  useEffect(() => { if (left === 0) onExpire(); }, [left === 0]);
  const s = Math.ceil(left / 1000);
  return (
    <span class={`timer ${s < 300 ? 'low' : ''}`}>
      {String(Math.floor(s / 60)).padStart(2, '0')}:{String(s % 60).padStart(2, '0')}
    </span>
  );
}

function Results({ t, title, isExam, timeUp, refs, answers, lookup, onRetry }: {
  t: Strings; title: string; isExam: boolean; timeUp: boolean; refs: Ref[]; answers: Record<number, number>;
  lookup: Map<string, Question>; onRetry: () => void;
}) {
  const rows = refs.map((r, i) => ({ r, q: lookup.get(`${r.g}:${r.n}`)!, a: answers[i] }));
  const answered = rows.filter((x) => x.a != null);
  const ok = rows.filter((x) => x.a === x.q.a).length;
  const total = isExam ? rows.length : answered.length;
  const wrong = rows.filter((x) => (isExam ? x.a !== x.q.a : x.a != null && x.a !== x.q.a));
  const passed = isExam && rows.length - ok <= EXAM_MAX_WRONG;

  return (
    <main class="quiz">
      <QuizBar title={title} />
      <section class={`card result ${isExam ? (passed ? 'pass' : 'fail') : ''}`}>
        {isExam && <h2>{passed ? `🎉 ${t.passed}` : t.failed}</h2>}
        {timeUp && <p class="muted">{t.timeUp}</p>}
        <div class="big">
          {ok}<span class="muted">/{total}</span>
        </div>
        <p class="muted">
          {t.correct}: {ok} · {t.wrong}: {wrong.length}
        </p>
        <div class="row">
          <button class="btn primary" onClick={onRetry}>{t.retry}</button>
          <a class="btn" href="#/">{t.home}</a>
        </div>
      </section>
      {wrong.length > 0 && (
        <>
          <h2 class="section-title">{t.review}</h2>
          {wrong.map(({ r, q, a }) => (
            <div class="review" key={`${r.g}:${r.n}`}>
              <span class="tag">{t.group} {r.g} · #{r.n}{a == null ? ` · ${t.unanswered}` : ''}</span>
              <QuestionView q={q} chosen={a} reveal onChoose={() => {}} />
            </div>
          ))}
        </>
      )}
    </main>
  );
}
