import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Grade, type FSRS } from 'ts-fsrs';
import type { StateRow } from './db';

export { Rating, State };
export type Voto = 1 | 2 | 3 | 4;

export const VOTI: { voto: Voto; label: string; tono: string }[] = [
  { voto: 1, label: 'Di nuovo', tono: 'bad' },
  { voto: 2, label: 'Difficile', tono: 'warn' },
  { voto: 3, label: 'Bene', tono: 'good' },
  { voto: 4, label: 'Facile', tono: 'easy' },
];

export interface SchedulerOptions {
  retention?: number;
  fuzz?: boolean;
}

export function makeScheduler({ retention = 0.9, fuzz = true }: SchedulerOptions = {}): FSRS {
  return fsrs(
    generatorParameters({
      request_retention: retention,
      enable_fuzz: fuzz,
      enable_short_term: true,
      maximum_interval: 3650,
    }),
  );
}

/** Applica un voto a una card e restituisce il nuovo stato da salvare. */
export function applyRating(
  f: FSRS,
  cardId: string,
  prev: StateRow | undefined,
  voto: Voto,
  now: Date = new Date(),
): StateRow {
  const base: StateRow = prev ?? { ...createEmptyCard(now), cardId, firstReview: now.getTime() };
  const { cardId: _id, firstReview, ...card } = base;
  const { card: next } = f.next(card, now, voto as Grade);
  return { ...next, cardId, firstReview };
}

/** Anteprima dell'intervallo per ciascun voto (per le etichette dei pulsanti). */
export function previewIntervals(f: FSRS, prev: StateRow | undefined, now: Date = new Date()): Record<Voto, string> {
  const card = prev ? stripRow(prev) : createEmptyCard(now);
  const rec = f.repeat(card, now);
  const out = {} as Record<Voto, string>;
  for (const v of [1, 2, 3, 4] as Voto[]) out[v] = formatInterval(rec[v as Grade].card.due.getTime() - now.getTime());
  return out;
}

export function retrievability(f: FSRS, s: StateRow | undefined, now: Date = new Date()): number {
  if (!s || s.state === State.New) return 0;
  return f.get_retrievability(stripRow(s), now, false);
}

function stripRow(s: StateRow) {
  const { cardId: _c, firstReview: _f, ...card } = s;
  return card;
}

export function formatInterval(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  if (d < 31) return `${d} g`;
  const m = d / 30;
  if (m < 12) return `${Math.round(m)} mesi`;
  return `${(d / 365).toFixed(1).replace('.', ',')} anni`;
}
