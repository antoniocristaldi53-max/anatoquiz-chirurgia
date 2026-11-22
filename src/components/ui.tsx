import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { go } from '../lib/router';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'secondary',
  big,
  className,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; big?: boolean }) {
  return (
    <button
      {...p}
      className={cx(
        'rounded-2xl font-semibold transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100',
        big ? 'min-h-14 px-5 text-lg' : 'min-h-12 px-4',
        variant === 'primary' && 'bg-accent text-accent-fg',
        variant === 'secondary' && 'bg-surface2 text-fg border border-line',
        variant === 'ghost' && 'text-accent',
        variant === 'danger' && 'bg-bad/15 text-bad border border-bad/40',
        className,
      )}
    />
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-2xl border border-line bg-surface p-4', className)}>{children}</div>;
}

export function Pill({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'warn' | 'accent' | 'bad' | 'good' }) {
  const t = {
    muted: 'bg-surface2 text-muted',
    warn: 'bg-warn/15 text-warn',
    accent: 'bg-accent/15 text-accent',
    bad: 'bg-bad/15 text-bad',
    good: 'bg-good/15 text-good',
  }[tone];
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', t)}>{children}</span>;
}

export function Screen({
  title,
  back,
  right,
  children,
  nav = true,
}: {
  title: string;
  back?: string;
  right?: ReactNode;
  children: ReactNode;
  nav?: boolean;
}) {
  return (
    <div className={cx('mx-auto max-w-2xl px-4 pt-safe', nav ? 'pb-nav' : 'pb-safe')}>
      <header className="flex min-h-12 items-center gap-2 pb-3">
        {back !== undefined && (
          <button aria-label="Indietro" onClick={() => (back ? go(back) : history.back())} className="-ml-2 grid size-11 place-items-center rounded-full text-2xl text-accent">
            ‹
          </button>
        )}
        <h1 className="flex-1 text-2xl font-bold tracking-tight">{title}</h1>
        {right}
      </header>
      {children}
    </div>
  );
}

const TABS = [
  { path: '/', label: 'Oggi', icon: '◉' },
  { path: '/statistiche', label: 'Statistiche', icon: '▤' },
  { path: '/revisione', label: 'Revisione', icon: '✓' },
  { path: '/immagini', label: 'Immagini', icon: '◫' },
  { path: '/impostazioni', label: 'Altro', icon: '⋯' },
];

export function BottomNav({ path }: { path: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur pb-safe">
      <div className="mx-auto flex max-w-2xl">
        {TABS.map((t) => {
          const active = t.path === '/' ? path === '/' : path.startsWith(t.path);
          return (
            <a
              key={t.path}
              href={`#${t.path}`}
              className={cx('flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1 text-xs font-medium', active ? 'text-accent' : 'text-muted')}
            >
              <span className="text-xl leading-none" aria-hidden>
                {t.icon}
              </span>
              {t.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputCls = 'w-full rounded-xl border border-line bg-surface2 px-3 py-3 text-base text-fg outline-none focus:border-accent';

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">{children}</div>;
}

/** "1 risposta" / "N risposte" */
export const nRisposte = (n: number) => `${n} ${n === 1 ? 'risposta' : 'risposte'}`;

export function pct(x: number | null | undefined, digits = 0) {
  return x === null || x === undefined ? '—' : `${(x * 100).toFixed(digits)}%`;
}

/** Scala sequenziale a una tinta (accent, chiaro→scuro) per heatmap e padronanza. */
export function heatColor(p: number | null): string {
  if (p === null) return 'var(--surface2)';
  const k = Math.round(12 + p * 78);
  return `color-mix(in oklab, var(--accent) ${k}%, var(--surface2))`;
}

/** Testo leggibile sopra heatColor. */
export function heatInk(p: number | null): string {
  return p !== null && p >= 0.55 ? 'var(--accent-fg)' : 'var(--fg)';
}

export function downloadFile(name: string, content: string | Blob, type = 'application/json') {
  const blob = typeof content === 'string' ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
