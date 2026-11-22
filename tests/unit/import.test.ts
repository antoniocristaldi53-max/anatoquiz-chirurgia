import { beforeEach, describe, expect, it } from 'vitest';
import { AnatoDB } from '../../src/lib/db';
import { importCards, parseImportText } from '../../src/lib/importer';
import { cardToMarkdown } from '../../src/lib/markdown';
import { CardSchema } from '../../src/lib/schema';
import { mcq, tenCardsOneBroken } from './fixtures';

let d: AnatoDB;
beforeEach(async () => {
  d = new AnatoDB(`t-${Math.random()}`);
  await d.open();
});

describe('import', () => {
  it('10 card di cui 1 malformata: entrano le 9 valide, la 7ª è segnalata con il motivo', async () => {
    const parsed = parseImportText(JSON.stringify(tenCardsOneBroken()), 'nuove.json');
    expect(parsed.kind).toBe('cards');
    if (parsed.kind !== 'cards') return;
    const rep = await importCards(parsed.items, parsed.preErrors, d);
    expect(rep.aggiunte).toHaveLength(9);
    expect(rep.errori).toHaveLength(1);
    expect(rep.errori[0].posizione).toBe(7);
    expect(rep.errori[0].id).toBe('test-0007');
    expect(rep.errori[0].motivi.join(' ')).toMatch(/livello/);
    expect(await d.cards.count()).toBe(9);
  });

  it('non crea duplicati (confronto per id), anche dentro lo stesso file', async () => {
    await importCards([mcq('dup-0001')], [], d);
    const rep = await importCards([mcq('dup-0001'), mcq('dup-0002'), mcq('dup-0002')], [], d);
    expect(rep.aggiunte).toEqual(['dup-0002']);
    expect(rep.duplicate).toEqual(['dup-0001', 'dup-0002']);
    expect(await d.cards.count()).toBe(2);
  });

  it('accetta { cards: [...] } e segnala JSON non valido', async () => {
    const p = parseImportText(JSON.stringify({ cards: [mcq('obj-0001')] }));
    expect(p.kind === 'cards' && p.items.length).toBe(1);
    const bad = parseImportText('{ non json', 'x.json');
    expect(bad.kind === 'cards' && bad.preErrors[0].motivi[0]).toMatch(/JSON non valido/);
  });

  it('importa il formato Markdown (andata e ritorno)', async () => {
    const tipi = [
      CardSchema.parse(mcq('md-0001', { tipo: 'multi', corrette: [0, 2], perla: 'Perla' })),
      CardSchema.parse(mcq('md-0002', { tipo: 'ordina', corrette: [2, 0, 1] })),
      CardSchema.parse(mcq('md-0003', { tipo: 'flash', opzioni: undefined, corrette: 'Il dotto epatico comune' })),
    ];
    const md = '# Mie card\n\n' + tipi.map(cardToMarkdown).join('\n---\n\n');
    const p = parseImportText(md, 'mie.md');
    if (p.kind !== 'cards') throw new Error('atteso cards');
    expect(p.preErrors).toEqual([]);
    const rep = await importCards(p.items, p.preErrors, d);
    expect(rep.errori).toEqual([]);
    const back = await d.cards.get('md-0001');
    expect(back).toMatchObject({ tipo: 'multi', corrette: [0, 2], perla: 'Perla', interventi: ['colecistectomia VLS'] });
    const ord = await d.cards.get('md-0002');
    // nel Markdown l'ordine è scritto già corretto
    expect(ord?.opzioni).toEqual(['Coledoco', 'Margine inferiore del fegato', 'Dotto cistico']);
    expect(ord?.corrette).toEqual([0, 1, 2]);
    expect((await d.cards.get('md-0003'))?.corrette).toBe('Il dotto epatico comune');
  });

  it('Markdown: segnala blocchi malformati senza bloccare gli altri', async () => {
    const md = `## md-ok
distretto: collo
argomento: Ricorrente
tipo: mcq
livello: 1
### Domanda
Dove decorre il nervo laringeo ricorrente destro?
### Opzioni
- [x] Attorno alla succlavia destra
- [ ] Attorno all'arco aortico
### Spiegazione
Il ricorrente destro gira attorno alla succlavia.
### Fonte
Gray's Anatomy | sezione Collo

## md-ko
distretto: collo
tipo: mcq
livello: 9
### Domanda
?
### Spiegazione
x
### Fonte
x | y
`;
    const p = parseImportText(md, 'x.md');
    if (p.kind !== 'cards') throw new Error();
    const rep = await importCards(p.items, p.preErrors, d);
    expect(rep.aggiunte).toEqual(['md-ok']);
    expect(rep.errori).toHaveLength(1);
    expect(rep.errori[0].id).toBe('md-ko');
  });
});
