import { useState } from 'react';
import type { DayPoint, HeatCell, Mastery } from '../lib/stats';
import { breveDistretto } from '../lib/schema';
import { heatColor, heatInk, nRisposte, pct } from './ui';

export function MasteryGrid({ mastery, compact }: { mastery: Mastery[]; compact?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="mappa-padronanza">
      {mastery.map((m) => {
        const p = m.viste ? m.padronanza : null;
        return (
          <a
            key={m.distretto}
            href={`#/sessione?mode=esplora&distretto=${m.distretto}`}
            title={`${breveDistretto(m.distretto)}: padronanza ${pct(m.padronanza)}, ${m.viste}/${m.totali} card viste, richiamo medio ${pct(m.richiamo)}`}
            className="rounded-xl border border-line p-3"
            style={{ background: heatColor(p), color: heatInk(p) }}
          >
            <div className="text-sm font-semibold leading-tight">{breveDistretto(m.distretto)}</div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="text-xl font-bold">{pct(m.padronanza)}</span>
              {!compact && <span className="text-xs opacity-80">{m.viste}/{m.totali}</span>}
            </div>
          </a>
        );
      })}
    </div>
  );
}

export function SeqLegend() {
  return (
    <div className="mt-2 flex items-center gap-2 text-xs text-muted">
      <span>0%</span>
      <span className="h-2.5 flex-1 rounded-full" style={{ background: `linear-gradient(to right, ${heatColor(0)}, ${heatColor(0.5)}, ${heatColor(1)})` }} />
      <span>100%</span>
      <span className="ml-2 inline-block size-3 rounded-sm border border-line" style={{ background: 'var(--surface2)' }} /> nessun dato
    </div>
  );
}

export function RecallHeatmap({ rows, weeks }: { rows: { distretto: string; cells: HeatCell[]; totale: HeatCell }[]; weeks: number }) {
  return (
    <div className="overflow-x-auto" data-testid="heatmap">
      <table className="w-full table-fixed border-separate border-spacing-[2px] text-[11px]">
        <thead>
          <tr className="text-muted">
            <th className="w-[30%] text-left font-medium">Distretto</th>
            {Array.from({ length: weeks }, (_, i) => (
              <th key={i} className="font-medium" title={i === weeks - 1 ? 'Settimana corrente' : `${weeks - 1 - i} settimane fa`}>{i === weeks - 1 ? 'Ora' : `−${weeks - 1 - i}`}</th>
            ))}
            <th className="font-medium">Tot</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.distretto}>
              <td className="truncate pr-1">{breveDistretto(r.distretto)}</td>
              {[...r.cells, r.totale].map((c, i) => (
                <td
                  key={i}
                  title={c.n ? `${pct(c.pct)} corrette su ${nRisposte(c.n)}` : 'nessuna risposta'}
                  className={`h-8 rounded text-center font-semibold ${i === r.cells.length ? 'border border-line' : ''}`}
                  style={{ background: heatColor(c.pct), color: heatInk(c.pct) }}
                >
                  {c.n ? pct(c.pct) : ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Barre giornaliere (numero di risposte) per gli ultimi 30 giorni; tooltip al tocco/hover. */
export function TrendChart({ days }: { days: DayPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = 160;
  const pad = { l: 28, b: 20, t: 8 };
  const max = Math.max(5, ...days.map((d) => d.n));
  const step = (W - pad.l) / days.length;
  const bw = Math.max(3, step - 2);
  const y = (v: number) => H - pad.b - (v / max) * (H - pad.b - pad.t);
  const h = hover !== null ? days[hover] : null;
  const fmt = (d: Date) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  return (
    <div className="relative" data-testid="trend">
      <div className="mb-1 h-5 text-sm text-muted">
        {h ? (
          <span>
            <b className="text-fg">{fmt(h.date)}</b>: {nRisposte(h.n)}{h.n ? `, ${pct(h.correct / h.n)} corrette` : ''}
          </span>
        ) : (
          'Tocca una barra per i dettagli'
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Risposte al giorno negli ultimi 30 giorni" onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={W} y1={y(max * g)} y2={y(max * g)} stroke="var(--line)" strokeWidth={1} />
            <text x={pad.l - 4} y={y(max * g) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">{Math.round(max * g)}</text>
          </g>
        ))}
        {days.map((d, i) => {
          const x = pad.l + i * step + 1;
          const top = y(d.n);
          const hgt = H - pad.b - top;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
              <rect x={pad.l + i * step} y={pad.t} width={step} height={H - pad.b - pad.t} fill="transparent" />
              {d.n > 0 && (
                <path
                  d={`M${x},${H - pad.b} V${top + Math.min(4, hgt)} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${H - pad.b} Z`}
                  fill="var(--accent)"
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              )}
            </g>
          );
        })}
        {[0, days.length - 1].map((i) => (
          <text key={i} x={pad.l + i * step + step / 2} y={H - 4} textAnchor={i ? 'end' : 'start'} fontSize={11} fill="var(--muted)">
            {fmt(days[i].date)}
          </text>
        ))}
      </svg>
    </div>
  );
}
