import { useMemo } from 'preact/hooks';
import type { Bank } from './data';
import type { Strings } from './i18n';
import { qid, resetAll, useStore, type SetId } from './store';

type Props = { bank: Bank | null; set: SetId; t: Strings };

export function Home({ bank, set, t }: Props) {
  const stats = useStore((s) => s.stats);
  const marks = useStore((s) => s.marks);
  const pos = useStore((s) => s.pos);
  const exams = useStore((s) => s.exams);

  const summary = useMemo(() => {
    if (!bank) return null;
    let total = 0, learned = 0, answered = 0, c = 0, w = 0, mistakes = 0, bookmarks = 0;
    const groups = bank.map((g) => {
      let gl = 0, gw = 0, ga = 0;
      for (const q of g.qs) {
        const id = qid(set, g.g, q.n);
        const s = stats[id];
        if (marks[id]) bookmarks++;
        if (!s) continue;
        ga++; c += s.c; w += s.w;
        if (s.l) gl++; else { gw++; mistakes++; }
      }
      total += g.qs.length; learned += gl; answered += ga;
      return { g: g.g, n: g.qs.length, learned: gl, wrong: gw, answered: ga };
    });
    return { total, learned, answered, acc: c + w ? Math.round((100 * c) / (c + w)) : 0, mistakes, bookmarks, groups };
  }, [bank, set, stats, marks]);

  if (!summary) return <Skeleton />;
  const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
  const setExams = exams.filter((e) => e.set === set).slice(0, 6);

  return (
    <main class="home">
      <section class="card overall">
        <div class="ring" style={{ '--p': pct(summary.learned, summary.total) } as any}>
          <span>{pct(summary.learned, summary.total)}%</span>
        </div>
        <div class="overall-text">
          <h2>{t.overall}</h2>
          <p>
            <b>{summary.learned}</b> / {summary.total} {t.learned}
          </p>
          <p class="muted">
            {t.answered}: {summary.answered} · {t.accuracy}: {summary.acc}%
          </p>
        </div>
      </section>

      <a class="card hero" href="#/quiz/exam">
        <div class="hero-icon">⏱</div>
        <div>
          <h2>{t.exam}</h2>
          <p>{t.examDesc}</p>
        </div>
        <span class="chev">›</span>
      </a>

      <div class="modes">
        <a class="card mode" href="#/quiz/marathon">
          <h3>🏃 {t.marathon}</h3>
          <p class="muted">{t.marathonDesc}</p>
        </a>
        <a class={`card mode ${summary.mistakes ? '' : 'disabled'}`} href={summary.mistakes ? '#/quiz/mistakes' : undefined}>
          <h3>
            ✗ {t.mistakes} <span class="badge bad">{summary.mistakes}</span>
          </h3>
          <p class="muted">{t.mistakesDesc}</p>
        </a>
        <a class={`card mode ${summary.bookmarks ? '' : 'disabled'}`} href={summary.bookmarks ? '#/quiz/bookmarks' : undefined}>
          <h3>
            ★ {t.bookmarks} <span class="badge">{summary.bookmarks}</span>
          </h3>
          <p class="muted">{t.bookmarksDesc}</p>
        </a>
      </div>

      <h2 class="section-title">{t.groups}</h2>
      <div class="groups">
        {summary.groups.map((g) => {
          const p = pos[`${set}:${g.g}`] ?? 0;
          return (
            <a class="card group" href={`#/quiz/group/${g.g}`} key={g.g}>
              <div class="group-head">
                <span class="group-num">{g.g}</span>
                <span class="muted">
                  {g.n} {t.questions}
                </span>
              </div>
              <div class="bar">
                <i class="ok" style={{ width: `${pct(g.learned, g.n)}%` }} />
                <i class="bad" style={{ width: `${pct(g.wrong, g.n)}%` }} />
              </div>
              <div class="group-foot muted">
                <span>
                  {pct(g.learned, g.n)}% {t.learned}
                </span>
                {p > 0 && p < g.n && <span>#{p + 1}</span>}
              </div>
            </a>
          );
        })}
      </div>

      {setExams.length > 0 && (
        <>
          <h2 class="section-title">{t.examHistory}</h2>
          <div class="card history">
            {setExams.map((e) => (
              <div class="history-row" key={e.ts}>
                <span class={`dot ${e.passed ? 'ok' : 'bad'}`} />
                <b>
                  {e.ok}/{e.total}
                </b>
                <span class="muted">{new Date(e.ts).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <footer class="foot muted">
        <p class="keys">{t.keys}</p>
        <p>
          <button class="link" onClick={() => confirm(t.resetConfirm) && resetAll()}>
            {t.reset}
          </button>
          {' · '}
          <a href="https://roadpolice.am/hy/viv-exam" target="_blank" rel="noopener">
            {t.source}
          </a>
        </p>
      </footer>
    </main>
  );
}

export function Skeleton() {
  return (
    <main class="home">
      <div class="card skel" style={{ height: 120 }} />
      <div class="card skel" style={{ height: 90 }} />
      <div class="groups">
        {Array.from({ length: 10 }, (_, i) => (
          <div class="card skel" style={{ height: 96 }} key={i} />
        ))}
      </div>
    </main>
  );
}
