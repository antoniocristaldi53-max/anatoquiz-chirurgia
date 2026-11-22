import { expect, test } from '@playwright/test';
import { answerCurrent, freshStart } from './helpers';

test('modalità aereo: l\'app si apre offline e completa una sessione flash da 5 minuti', async ({ page, context }) => {
  await freshStart(page);
  // il service worker deve aver messo in cache l'app
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  });
  await page.reload();
  await expect(page.getByTestId('mode-giorno')).toBeVisible();

  // qualche card studiata, così la sessione flash ha materiale
  await page.getByTestId('mode-giorno').click();
  for (let i = 0; i < 4; i++) await answerCurrent(page, 3);
  await page.getByTestId('termina').click();
  await page.getByRole('button', { name: 'Torna a Oggi' }).click();

  page.on('pageerror', (e) => console.log('PAGEERROR', e.stack?.slice(0, 600)));
  await context.setOffline(true);
  await page.clock.install();
  await page.reload();
  await expect(page.getByTestId('mode-flash')).toBeVisible();
  await page.getByTestId('mode-flash').click();
  await expect(page.getByTestId('timer')).toHaveText('5:00');

  await answerCurrent(page, 3);
  await page.clock.fastForward('05:01');
  await expect(page.getByTestId('timer')).toHaveText('0:00');
  await answerCurrent(page, 3);
  await expect(page.getByTestId('riepilogo')).toBeVisible();
  await expect(page.getByTestId('riepilogo')).toContainText('2');
});
