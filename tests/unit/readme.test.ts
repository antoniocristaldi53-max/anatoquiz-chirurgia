import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AnatoDB } from '../../src/lib/db';
import { importCards, parseImportText } from '../../src/lib/importer';

const readme = readFileSync(join(__dirname, '../../README.md'), 'utf8');
const block = (lang: string) => readme.match(new RegExp('```' + lang + '\\n([\\s\\S]*?)\\n```'))![1];

describe('esempi del README', () => {
  it.each([['json', 'esempio.json', 1], ['markdown', 'esempio.md', 4]])('l\'esempio %s si importa senza errori', async (lang, name, n) => {
    const d = new AnatoDB(`readme-${Math.random()}`);
    const p = parseImportText(block(lang), name);
    if (p.kind !== 'cards') throw new Error('atteso cards');
    const rep = await importCards(p.items, p.preErrors, d);
    expect(rep.errori).toEqual([]);
    expect(rep.aggiunte).toHaveLength(n);
  });
});
