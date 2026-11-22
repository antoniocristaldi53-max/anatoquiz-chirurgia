import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DISTRETTI, TIPI, validateCard, type CardT } from '../../src/lib/schema';

const dir = join(__dirname, '../../content');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const all: { file: string; raw: unknown }[] = files.flatMap((file) =>
  (JSON.parse(readFileSync(join(dir, file), 'utf8')) as unknown[]).map((raw) => ({ file, raw })),
);

describe('contenuti di base', () => {
  it('ogni card è valida', () => {
    const errs = all
      .map(({ file, raw }) => ({ file, id: (raw as CardT).id, r: validateCard(raw) }))
      .filter((x) => !x.r.ok)
      .map((x) => `${x.file} ${x.id}: ${!x.r.ok && x.r.errors.join('; ')}`);
    expect(errs).toEqual([]);
  });

  it('id univoci', () => {
    const ids = all.map((x) => (x.raw as CardT).id);
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dup).toEqual([]);
  });

  it('tutte le card generate partono non verificate', () => {
    expect(all.filter((x) => (x.raw as CardT).verificata !== false).map((x) => (x.raw as CardT).id)).toEqual([]);
  });

  it('le immagini referenziate esistono', () => {
    const missing = all
      .map((x) => x.raw as CardT)
      .filter((c) => c.immagine && !c.immagine.src.startsWith('idb:') && !existsSync(join(__dirname, '../../public', c.immagine.src)))
      .map((c) => `${c.id} → ${c.immagine!.src}`);
    expect(missing).toEqual([]);
  });

  const presenti = new Set(all.map((x) => (x.raw as CardT).distretto));
  for (const d of DISTRETTI.filter((x) => presenti.has(x.id))) {
    it(`${d.id}: almeno 25 card, tutti i tipi e tutti i livelli`, () => {
      const cs = all.map((x) => x.raw as CardT).filter((c) => c.distretto === d.id);
      expect(cs.length).toBeGreaterThanOrEqual(25);
      expect(new Set(cs.map((c) => c.tipo))).toEqual(new Set(TIPI));
      expect(new Set(cs.map((c) => c.livello))).toEqual(new Set([1, 2, 3]));
      expect(cs.some((c) => c.tag.includes('correlazione'))).toBe(true);
      expect(cs.some((c) => c.tag.includes('variante'))).toBe(true);
    });
  }
});
