import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { answerCurrent, freshStart } from './helpers';

const contentDir = join(process.cwd(), 'content');
const allCards: { id: string; interventi: string[]; tag: string[] }[] = readdirSync(contentDir)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(contentDir, f), 'utf8')));

test('ripasso del giorno: sessione completa, la card sbagliata ricompare nella stessa sessione', async ({ page }) => {
  await freshStart(page);
  await expect(page.getByTestId('mode-giorno')).toContainText('10 nuove');
  await page.getByTestId('mode-giorno').click();

  // prima card: "Di nuovo" → deve tornare entro le 3–4 card successive
  const first = await answerCurrent(page, 1);
  const seen: string[] = [];
  for (let i = 0; i < 4; i++) seen.push(await answerCurrent(page, 3));
  expect(seen).toContain(first);

  // completa la sessione
  for (let i = 0; i < 60 && !(await page.getByTestId('riepilogo').isVisible()); i++) await answerCurrent(page, 3);
  await expect(page.getByTestId('riepilogo')).toBeVisible();
  await expect(page.getByTestId('riepilogo')).toContainText('risposte');

  // le statistiche registrano le risposte
  await page.getByRole('button', { name: 'Torna a Oggi' }).click();
  await page.getByRole('link', { name: /Statistiche/ }).click();
  await expect(page.getByTestId('heatmap')).toBeVisible();
  await expect(page.getByTestId('trend')).toBeVisible();
});

test('pre-sala colecistectomia VLS: solo card pertinenti, strutture a rischio per prime', async ({ page }) => {
  await freshStart(page);
  await page.getByTestId('mode-presala').click();
  await page.getByTestId('intervento').filter({ hasText: /^colecistectomia VLS/ }).click();
  await expect(page.getByTestId('strutture-rischio')).toBeVisible();
  await page.getByRole('button', { name: 'Inizia' }).click();

  const pertinenti = new Set(allCards.filter((c) => c.interventi.includes('colecistectomia VLS')).map((c) => c.id));
  const rischio = new Set(allCards.filter((c) => c.interventi.includes('colecistectomia VLS') && c.tag.includes('a-rischio')).map((c) => c.id));
  const first = await answerCurrent(page, 3);
  expect(rischio.has(first)).toBe(true);
  for (let i = 0; i < 8; i++) {
    const id = await answerCurrent(page, 3);
    expect(pertinenti.has(id), `${id} non è collegata alla colecistectomia VLS`).toBe(true);
  }
});

test('import di 10 card con 1 malformata: entrano 9, la malformata è segnalata', async ({ page }) => {
  await freshStart(page);
  const base = {
    distretto: 'collo', argomento: 'Test import', interventi: ['tiroidectomia totale'], tipo: 'mcq', livello: 1,
    domanda: 'Domanda di prova?', opzioni: ['A', 'B', 'C'], corrette: [0], spiegazione: 'Spiegazione', 
    fonte: { testo: 'Test', riferimento: 'Test' }, tag: [], verificata: false,
  };
  const cards: Record<string, unknown>[] = Array.from({ length: 10 }, (_, i) => ({ ...base, id: `e2e-${i + 1}` }));
  cards[4] = { ...cards[4], corrette: [9] };
  await page.getByRole('link', { name: /Altro/ }).click();
  await page.getByTestId('file-import').setInputFiles({ name: 'nuove.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(cards)) });
  const report = page.getByTestId('report-import');
  await expect(report).toContainText('9 aggiunte');
  await expect(report).toContainText('1 con errori');
  await expect(page.getByTestId('errore-import')).toContainText('Card n. 5 (e2e-5)');
  await expect(page.getByTestId('errore-import')).toContainText('oltre il numero di opzioni');

  // reimportare lo stesso file non crea duplicati
  await page.getByTestId('file-import').setInputFiles({ name: 'nuove.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(cards)) });
  await expect(report).toContainText('0 aggiunte');
  await expect(report).toContainText('9 già presenti');
});

test('backup: export, cancellazione, reimport → card e progressi identici', async ({ page }) => {
  await freshStart(page);
  await page.getByTestId('mode-esplora').click();
  await page.getByTestId('distretto-collo').click();
  for (let i = 0; i < 3; i++) await answerCurrent(page, 3);
  await page.getByTestId('termina').click();
  await page.getByRole('button', { name: 'Torna a Oggi' }).click();
  await page.getByRole('link', { name: /Altro/ }).click();
  const stato = page.getByText(/risposte registrate/);
  const prima = await stato.innerText();
  expect(prima).toContain('3 risposte');

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('esporta').click()]);
  const file = await download.path();

  page.on('dialog', (d) => d.accept());
  await page.getByTestId('cancella-tutto').click();
  await expect(page.getByTestId('msg-import')).toContainText('Dati cancellati');
  await page.reload();
  await page.getByRole('link', { name: /Altro/ }).click();
  await expect(page.getByText(/risposte registrate/)).toContainText('0 risposte');

  await page.getByTestId('file-import').setInputFiles(file!);
  await expect(page.getByTestId('msg-import')).toContainText('Backup ripristinato');
  await expect(page.getByText(/risposte registrate/)).toHaveText(prima);
});
