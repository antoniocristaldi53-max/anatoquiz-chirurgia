import { describe, expect, it } from 'vitest';
import type { StateRow } from '../../src/lib/db';
import { applyRating, makeScheduler } from '../../src/lib/fsrs';
import { buildQueue, listInterventi, TAG_RISCHIO, type QueueInput } from '../../src/lib/queue';
import { CardSchema } from '../../src/lib/schema';
import { mcq } from './fixtures';

const f = makeScheduler({ fuzz: false });
const now = new Date('2026-11-22T10:00:00');

function input(over: Partial<QueueInput> = {}): QueueInput {
  const cards = [
    CardSchema.parse(mcq('c-0001', { interventi: ['colecistectomia VLS'], tag: [TAG_RISCHIO] })),
    CardSchema.parse(mcq('c-0002', { interventi: ['colecistectomia VLS'] })),
    CardSchema.parse(mcq('c-0003', { interventi: ['tiroidectomia totale'], distretto: 'collo' })),
    ...Array.from({ length: 20 }, (_, i) => CardSchema.parse(mcq(`n-${i}`, { interventi: [] }))),
  ];
  return { cards, states: new Map(), reviews: [], f, now, newPerDay: 10, includeUnverified: true, ...over };
}

describe('code di studio', () => {
  it('pre-sala: solo card dell\'intervento, strutture a rischio per prime', () => {
    const q = buildQueue('presala', input(), { intervento: 'colecistectomia VLS' }, 1);
    expect(q.map((c) => c.id)).toEqual(['c-0001', 'c-0002']);
    expect(q.every((c) => c.interventi.includes('colecistectomia VLS'))).toBe(true);
  });

  it('giorno: scadute + nuove fino al limite giornaliero', () => {
    const states = new Map<string, StateRow>();
    const ieri = new Date(+now - 3 * 86400000);
    states.set('c-0003', applyRating(f, 'c-0003', undefined, 3, ieri));
    const q = buildQueue('giorno', input({ states, newPerDay: 5 }));
    expect(q.filter((c) => c.id === 'c-0003')).toHaveLength(1);
    expect(q.filter((c) => !states.has(c.id))).toHaveLength(5);
  });

  it('giorno: le nuove introdotte oggi riducono il limite', () => {
    const states = new Map<string, StateRow>();
    for (let i = 0; i < 4; i++) states.set(`n-${i}`, applyRating(f, `n-${i}`, undefined, 4, now));
    const q = buildQueue('giorno', input({ states, newPerDay: 5 }));
    expect(q.filter((c) => !states.has(c.id))).toHaveLength(1);
  });

  it('esplora filtra per distretto; card non verificate escludibili', () => {
    expect(buildQueue('esplora', input(), { distretto: 'collo' }).map((c) => c.id)).toEqual(['c-0003']);
    expect(buildQueue('esplora', input({ includeUnverified: false }))).toHaveLength(0);
  });

  it('punti deboli: card con lapses', () => {
    const states = new Map<string, StateRow>();
    let s = applyRating(f, 'c-0002', undefined, 3, new Date(+now - 20 * 86400000));
    s = applyRating(f, 'c-0002', s, 1, new Date(+now - 10 * 86400000));
    s = applyRating(f, 'c-0002', s, 1, new Date(+now - 9 * 86400000));
    states.set('c-0002', s);
    states.set('c-0003', applyRating(f, 'c-0003', undefined, 4, now));
    expect(buildQueue('deboli', input({ states })).map((c) => c.id)).toEqual(['c-0002']);
  });

  it('elenco interventi con conteggio delle strutture a rischio', () => {
    expect(listInterventi(input().cards)).toEqual([
      { nome: 'colecistectomia VLS', n: 2, rischio: 1 },
      { nome: 'tiroidectomia totale', n: 1, rischio: 0 },
    ]);
  });
});
