import type { CardT } from './schema';

export type Risposta =
  | { tipo: 'scelta'; indici: number[] }
  | { tipo: 'ordine'; indici: number[] }
  | { tipo: 'flash' };

/** Valuta una risposta. Restituisce null per le flashcard (autovalutazione). */
export function isCorrect(card: CardT, r: Risposta): boolean | null {
  if (card.tipo === 'flash' || r.tipo === 'flash') return null;
  const ok = card.corrette as number[];
  if (card.tipo === 'ordina') return r.indici.length === ok.length && r.indici.every((v, i) => v === ok[i]);
  const a = [...r.indici].sort((x, y) => x - y);
  const b = [...ok].sort((x, y) => x - y);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
