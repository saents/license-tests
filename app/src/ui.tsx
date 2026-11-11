import { LANGS, type Lang } from './i18n';
import { update, useStore } from './store';

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div class="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={o.id === value} class={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function LangSwitch() {
  const lang = useStore((s) => s.lang);
  return <Segmented value={lang} options={LANGS} onChange={(v: Lang) => update(() => ({ lang: v }))} label="Language" />;
}
