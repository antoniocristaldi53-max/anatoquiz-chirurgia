import { describe, expect, it } from 'vitest';
import { applyRating, makeScheduler, previewIntervals, retrievability } from '../../src/lib/fsrs';
import { SessionEngine } from '../../src/lib/queue';

const f = makeScheduler({ fuzz: false });
const t0 = new Date('2026-11-22T08:00:00Z');
const min = (a: Date, b: Date) => (a.getTime() - b.getTime()) / 60000;
const days = (a: Date, b: Date) => (a.getTime() - b.getTime()) / 86400000;

describe('scheduling FSRS', () => {
  it('card nuova: "Di nuovo" torna entro minuti, "Facile" dopo giorni', () => {
    const again = applyRating(f, 'c1', undefined, 1, t0);
    expect(min(again.due, t0)).toBeLessThanOrEqual(10);
    expect(again.firstReview).toBe(t0.getTime());
    const easy = applyRating(f, 'c1', undefined, 4, t0);
    expect(days(easy.due, t0)).toBeGreaterThanOrEqual(1);
  });

  it('risposte "Bene" successive allungano gli intervalli', () => {
    let s = applyRating(f, 'c', undefined, 3, t0);
    let now = s.due;
    const intervals: number[] = [];
    for (let i = 0; i < 5; i++) {
      s = applyRating(f, 'c', s, 3, now);
      intervals.push(days(s.due, now));
      now = s.due;
    }
    for (let i = 1; i < intervals.length; i++) expect(intervals[i]).toBeGreaterThan(intervals[i - 1]);
    expect(s.reps).toBe(6);
    expect(s.lapses).toBe(0);
  });

  it('un errore su card matura è un lapse e riduce l\'intervallo', () => {
    let s = applyRating(f, 'c', undefined, 3, t0);
    for (let i = 0; i < 4; i++) s = applyRating(f, 'c', s, 3, s.due);
    const prima = s.scheduled_days;
    const lapse = applyRating(f, 'c', s, 1, s.due);
    expect(lapse.lapses).toBe(1);
    expect(days(lapse.due, s.due)).toBeLessThan(1);
    const dopo = applyRating(f, 'c', lapse, 3, lapse.due);
    expect(dopo.scheduled_days).toBeLessThan(prima);
  });

  it('anteprima degli intervalli e richiamo', () => {
    const p = previewIntervals(f, undefined, t0);
    expect(p[1]).toMatch(/min/);
    const s = applyRating(f, 'c', undefined, 3, t0);
    expect(retrievability(f, s, t0)).toBeGreaterThan(0.9);
    expect(retrievability(f, undefined, t0)).toBe(0);
  });
});

describe('sessione', () => {
  it('una card sbagliata ricompare nella stessa sessione dopo 3 card', () => {
    const e = new SessionEngine(['a', 'b', 'c', 'd', 'e']);
    expect(e.answer(1, false).requeued).toBe(true);
    expect(e.queue).toEqual(['b', 'c', 'd', 'a', 'e']);
    e.answer(3, true);
    e.answer(3, true);
    e.answer(3, true);
    expect(e.current).toBe('a');
    e.answer(3, true);
    expect(e.queue).toEqual(['e']);
  });

  it('a fine coda la card sbagliata torna subito; massimo 4 ripetizioni', () => {
    const e = new SessionEngine(['z']);
    for (let i = 0; i < 4; i++) expect(e.answer(1, false).requeued).toBe(true);
    expect(e.answer(1, false).requeued).toBe(false);
    expect(e.remaining).toBe(0);
    expect(e.answered).toBe(5);
  });
});
