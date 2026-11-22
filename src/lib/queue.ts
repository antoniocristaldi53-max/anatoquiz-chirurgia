import type { FSRS } from 'ts-fsrs';
import type { ModeId, ReviewRow, StateRow } from './db';
import { retrievability, type Voto } from './fsrs';
import type { CardT } from './schema';

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

export interface QueueInput {
  cards: CardT[];
  states: Map<string, StateRow>;
  reviews: ReviewRow[];
  f: FSRS;
  now: Date;
  newPerDay: number;
  includeUnverified: boolean;
}

export interface ModeOptions {
  intervento?: string;
  distretto?: string;
  tipo?: string;
  livello?: number;
}

export interface ModeInfo {
  id: ModeId;
  nome: string;
  descrizione: string;
  /** Se false la sessione non modifica la programmazione FSRS. */
  schedula: boolean;
  /** Durata fissa in secondi (sessione flash). */
  durata?: number;
}

export const MODES: Record<ModeId, ModeInfo> = {
  giorno: { id: 'giorno', nome: 'Ripasso del giorno', descrizione: 'Card in scadenza + nuove', schedula: true },
  flash: { id: 'flash', nome: 'Flash 5 minuti', descrizione: 'Scadute, poi le più deboli', schedula: true, durata: 300 },
  presala: { id: 'presala', nome: 'Pre-sala', descrizione: 'Card di un intervento', schedula: true },
  esplora: { id: 'esplora', nome: 'Esplora per distretto', descrizione: 'Libera, non modifica la programmazione', schedula: false },
  deboli: { id: 'deboli', nome: 'Punti deboli', descrizione: 'Molti errori o richiamo basso', schedula: true },
};

/** Tag che marca le card sulle strutture a rischio (mostrate per prime in pre-sala). */
export const TAG_RISCHIO = 'a-rischio';

/** PRNG deterministico per mescolare in modo riproducibile nei test. */
export function shuffle<T>(arr: T[], seed = Date.now()): T[] {
  const a = [...arr];
  let s = seed % 2147483647 || 1;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function eligible(input: QueueInput): CardT[] {
  return input.includeUnverified ? input.cards : input.cards.filter((c) => c.verificata);
}

export function dueCards(input: QueueInput, until = endOfDay(input.now)): CardT[] {
  return eligible(input)
    .filter((c) => {
      const s = input.states.get(c.id);
      return s && s.due.getTime() <= until.getTime();
    })
    .sort((a, b) => input.states.get(a.id)!.due.getTime() - input.states.get(b.id)!.due.getTime());
}

export function newIntroducedToday(input: QueueInput): number {
  const t0 = startOfDay(input.now).getTime();
  let n = 0;
  for (const s of input.states.values()) if (s.firstReview >= t0) n++;
  return n;
}

export function newCards(input: QueueInput): CardT[] {
  const remaining = Math.max(0, input.newPerDay - newIntroducedToday(input));
  return eligible(input)
    .filter((c) => !input.states.has(c.id))
    .sort((a, b) => a.livello - b.livello)
    .slice(0, remaining);
}

export interface CardStats {
  total: number;
  wrong: number;
}

export function statsByCard(reviews: ReviewRow[]): Map<string, CardStats> {
  const m = new Map<string, CardStats>();
  for (const r of reviews) {
    const s = m.get(r.cardId) ?? { total: 0, wrong: 0 };
    s.total++;
    if (!r.correct) s.wrong++;
    m.set(r.cardId, s);
  }
  return m;
}

/** Card deboli: ≥2 lapses, richiamo stimato < 80% o ≥40% di errori (con almeno 3 risposte). */
export function weakCards(input: QueueInput): CardT[] {
  const st = statsByCard(input.reviews);
  const scored = eligible(input)
    .filter((c) => input.states.has(c.id))
    .map((c) => {
      const s = input.states.get(c.id)!;
      const r = retrievability(input.f, s, input.now);
      const k = st.get(c.id);
      const errRate = k && k.total >= 3 ? k.wrong / k.total : 0;
      const weak = s.lapses >= 2 || r < 0.8 || errRate >= 0.4;
      return { c, r, errRate, weak };
    })
    .filter((x) => x.weak)
    .sort((a, b) => b.errRate - a.errRate || a.r - b.r);
  return scored.map((x) => x.c);
}

/** Inserisce le nuove tra le scadute (1 nuova ogni 3 scadute) per variare la sessione. */
function interleave(due: CardT[], fresh: CardT[]): CardT[] {
  const out: CardT[] = [];
  let i = 0;
  let j = 0;
  while (i < due.length || j < fresh.length) {
    for (let k = 0; k < 3 && i < due.length; k++) out.push(due[i++]);
    if (j < fresh.length) out.push(fresh[j++]);
  }
  return out;
}

export function buildQueue(mode: ModeId, input: QueueInput, opts: ModeOptions = {}, seed?: number): CardT[] {
  switch (mode) {
    case 'giorno':
      return interleave(dueCards(input), newCards(input));
    case 'flash': {
      const due = dueCards(input, input.now).sort(
        (a, b) => retrievability(input.f, input.states.get(a.id), input.now) - retrievability(input.f, input.states.get(b.id), input.now),
      );
      const ids = new Set(due.map((c) => c.id));
      const weakest = eligible(input)
        .filter((c) => input.states.has(c.id) && !ids.has(c.id))
        .sort(
          (a, b) => retrievability(input.f, input.states.get(a.id), input.now) - retrievability(input.f, input.states.get(b.id), input.now),
        );
      return [...due, ...weakest];
    }
    case 'presala': {
      const sel = eligible(input).filter((c) => opts.intervento && c.interventi.includes(opts.intervento));
      const risk = sel.filter((c) => c.tag.includes(TAG_RISCHIO));
      const rest = shuffle(
        sel.filter((c) => !c.tag.includes(TAG_RISCHIO)),
        seed,
      ).sort((a, b) => a.livello - b.livello);
      return [...shuffle(risk, seed), ...rest];
    }
    case 'esplora': {
      const sel = eligible(input).filter(
        (c) =>
          (!opts.distretto || c.distretto === opts.distretto) &&
          (!opts.tipo || c.tipo === opts.tipo) &&
          (!opts.livello || c.livello === opts.livello),
      );
      return shuffle(sel, seed);
    }
    case 'deboli':
      return weakCards(input).slice(0, 30);
  }
}

/** Elenco degli interventi presenti nelle card, con conteggio. */
export function listInterventi(cards: CardT[]): { nome: string; n: number; rischio: number }[] {
  const m = new Map<string, { n: number; rischio: number }>();
  for (const c of cards)
    for (const i of c.interventi) {
      const e = m.get(i) ?? { n: 0, rischio: 0 };
      e.n++;
      if (c.tag.includes(TAG_RISCHIO)) e.rischio++;
      m.set(i, e);
    }
  return [...m.entries()].map(([nome, v]) => ({ nome, ...v })).sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
}

/**
 * Motore della sessione: le card sbagliate (voto "Di nuovo") tornano nella stessa sessione
 * dopo `gap` card, fino a `maxRepeats` volte.
 */
export class SessionEngine {
  queue: string[];
  answered = 0;
  correct = 0;
  repeats = new Map<string, number>();

  constructor(
    ids: string[],
    private gap = 3,
    private maxRepeats = 4,
  ) {
    this.queue = [...ids];
  }

  get current(): string | undefined {
    return this.queue[0];
  }

  get remaining() {
    return this.queue.length;
  }

  answer(voto: Voto, wasCorrect: boolean): { requeued: boolean } {
    const id = this.queue.shift();
    if (!id) return { requeued: false };
    this.answered++;
    if (wasCorrect) this.correct++;
    const n = this.repeats.get(id) ?? 0;
    if (voto === 1 && n < this.maxRepeats) {
      this.repeats.set(id, n + 1);
      this.queue.splice(Math.min(this.gap, this.queue.length), 0, id);
      return { requeued: true };
    }
    return { requeued: false };
  }
}
