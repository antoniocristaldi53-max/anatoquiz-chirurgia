import type { FSRS } from 'ts-fsrs';
import type { ReviewRow, StateRow } from './db';
import { retrievability } from './fsrs';
import { startOfDay } from './queue';
import { DISTRETTI, type CardT } from './schema';

const DAY = 86400000;
const dayKey = (ts: number) => startOfDay(new Date(ts)).getTime();

/** Giorni consecutivi con almeno una risposta (oggi incluso, o fino a ieri se oggi non hai ancora studiato). */
export function streak(reviews: ReviewRow[], now = new Date()): number {
  const days = new Set(reviews.map((r) => dayKey(r.ts)));
  let d = startOfDay(now).getTime();
  if (!days.has(d)) d -= DAY;
  let n = 0;
  while (days.has(d)) {
    n++;
    d = startOfDay(new Date(d - DAY / 2)).getTime();
  }
  return n;
}

export interface DayPoint {
  date: Date;
  n: number;
  correct: number;
}

export function lastNDays(reviews: ReviewRow[], n = 30, now = new Date()): DayPoint[] {
  const t0 = startOfDay(now).getTime();
  const out: DayPoint[] = [];
  const idx = new Map<number, DayPoint>();
  for (let i = n - 1; i >= 0; i--) {
    const date = startOfDay(new Date(t0 - i * DAY + DAY / 2));
    const p = { date, n: 0, correct: 0 };
    out.push(p);
    idx.set(date.getTime(), p);
  }
  for (const r of reviews) {
    const p = idx.get(dayKey(r.ts));
    if (p) {
      p.n++;
      if (r.correct) p.correct++;
    }
  }
  return out;
}

export function avgSeconds(reviews: ReviewRow[], days = 30, now = new Date()): number | null {
  const since = now.getTime() - days * DAY;
  const rs = reviews.filter((r) => r.ts >= since && r.ms > 0 && r.ms < 10 * 60000);
  if (!rs.length) return null;
  return rs.reduce((a, r) => a + r.ms, 0) / rs.length / 1000;
}

export interface HeatCell {
  n: number;
  pct: number | null;
}

/** Richiamo (% risposte corrette) per distretto e per settimana: righe = distretti, colonne = ultime `weeks` settimane. */
export function recallHeatmap(reviews: ReviewRow[], weeks = 6, now = new Date()) {
  const end = startOfDay(now).getTime() + DAY;
  const rows = DISTRETTI.map((d) => ({ distretto: d.id, cells: Array.from({ length: weeks }, () => ({ n: 0, c: 0 })) }));
  const byId = new Map(rows.map((r) => [r.distretto, r]));
  for (const r of reviews) {
    const w = Math.floor((end - r.ts) / (7 * DAY));
    if (w < 0 || w >= weeks) continue;
    const row = byId.get(r.distretto as (typeof DISTRETTI)[number]['id']);
    if (!row) continue;
    const cell = row.cells[weeks - 1 - w];
    cell.n++;
    if (r.correct) cell.c++;
  }
  return rows.map((r) => ({
    distretto: r.distretto,
    cells: r.cells.map((c): HeatCell => ({ n: c.n, pct: c.n ? c.c / c.n : null })),
    totale: (() => {
      const n = r.cells.reduce((a, c) => a + c.n, 0);
      const c = r.cells.reduce((a, x) => a + x.c, 0);
      return { n, pct: n ? c / n : null };
    })(),
  }));
}

export interface Mastery {
  distretto: string;
  totali: number;
  viste: number;
  /** Richiamo medio stimato da FSRS sulle card viste (0–1). */
  richiamo: number | null;
  /** Padronanza: richiamo medio su TUTTE le card del distretto (le non viste contano 0). */
  padronanza: number;
}

export function masteryMap(cards: CardT[], states: Map<string, StateRow>, f: FSRS, now = new Date()): Mastery[] {
  return DISTRETTI.map((d) => {
    const cs = cards.filter((c) => c.distretto === d.id);
    const rs = cs.filter((c) => states.has(c.id)).map((c) => retrievability(f, states.get(c.id), now));
    const sum = rs.reduce((a, b) => a + b, 0);
    return {
      distretto: d.id,
      totali: cs.length,
      viste: rs.length,
      richiamo: rs.length ? sum / rs.length : null,
      padronanza: cs.length ? sum / cs.length : 0,
    };
  });
}
