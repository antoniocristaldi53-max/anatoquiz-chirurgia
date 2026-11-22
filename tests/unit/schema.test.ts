import { describe, expect, it } from 'vitest';
import { validateCard } from '../../src/lib/schema';
import { fonte, mcq } from './fixtures';

describe('validazione card', () => {
  it('accetta una mcq valida e applica i default', () => {
    const { verificata: _v, tag: _t, ...raw } = mcq('vb-0001');
    const r = validateCard(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.card.verificata).toBe(false);
      expect(r.card.tag).toEqual([]);
    }
  });

  it('accetta tutti i tipi', () => {
    const base = mcq('x-0001');
    const casi = [
      { ...base, id: 'x-multi', tipo: 'multi', corrette: [0, 2] },
      { ...base, id: 'x-flash', tipo: 'flash', opzioni: undefined, corrette: 'Risposta' },
      { ...base, id: 'x-ordina', tipo: 'ordina', corrette: [2, 0, 1] },
      { ...base, id: 'x-img', tipo: 'immagine', immagine: { src: 'img/calot.svg', hotspot: [{ x: 10, y: 20 }], target: 0 } },
    ];
    for (const c of casi) expect(validateCard(c), c.id).toMatchObject({ ok: true });
  });

  it.each([
    ['mcq con due corrette', { corrette: [0, 1] }, 'esattamente 1'],
    ['indice fuori range', { corrette: [7] }, 'oltre il numero di opzioni'],
    ['distretto sconosciuto', { distretto: 'cuore' }, 'distretto non valido'],
    ['livello 4', { livello: 4 }, 'livello'],
    ['fonte mancante', { fonte: undefined }, 'fonte'],
    ['id con maiuscole', { id: 'VB-1' }, 'id'],
    ['ordina incompleto', { tipo: 'ordina', corrette: [0, 1] }, 'tutti gli indici'],
    ['flash senza testo', { tipo: 'flash', corrette: [0] }, 'testo della risposta'],
    ['immagine senza hotspot', { tipo: 'immagine', immagine: { src: 'a.svg', hotspot: [] } }, 'hotspot'],
  ])('rifiuta: %s', (_n, patch, atteso) => {
    const r = validateCard({ ...mcq('vb-0002'), ...patch, fonte: 'fonte' in patch ? patch.fonte : fonte });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' | ')).toContain(atteso);
  });
});
