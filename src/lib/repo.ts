import { db as defaultDb, getSettings, reviveState, toStored, type AnatoDB, type ModeId, type StateRow } from './db';
import { applyRating, makeScheduler, type Voto } from './fsrs';
import type { CardT } from './schema';

export async function loadAll(d: AnatoDB = defaultDb) {
  const [cards, states, reviews, settings] = await Promise.all([
    d.cards.toArray(),
    d.states.toArray(),
    d.reviews.toArray(),
    getSettings(d),
  ]);
  return { cards, states: new Map(states.map((s) => [s.cardId, reviveState(s)])), reviews, settings };
}

export interface RecordArgs {
  card: CardT;
  voto: Voto;
  correct: boolean;
  ms: number;
  mode: ModeId;
  schedula: boolean;
  now?: Date;
  retention?: number;
}

/** Salva la risposta nel log e, se la modalità lo prevede, aggiorna lo stato FSRS. */
export async function recordReview(a: RecordArgs, d: AnatoDB = defaultDb): Promise<StateRow | undefined> {
  const now = a.now ?? new Date();
  return d.transaction('rw', d.states, d.reviews, async () => {
    await d.reviews.add({
      cardId: a.card.id,
      distretto: a.card.distretto,
      ts: now.getTime(),
      rating: a.voto,
      correct: a.correct,
      ms: Math.round(a.ms),
      mode: a.mode,
    });
    if (!a.schedula) return undefined;
    const stored = await d.states.get(a.card.id);
    const prev = stored && reviveState(stored);
    const next = applyRating(makeScheduler({ retention: a.retention }), a.card.id, prev, a.voto, now);
    await d.states.put(toStored(next));
    return next;
  });
}
