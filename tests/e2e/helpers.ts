import { expect, type Page } from '@playwright/test';

/** Risponde alla card corrente (scelta qualsiasi) e assegna un voto. Restituisce l'id della card. */
export async function answerCurrent(page: Page, voto: 1 | 3 = 3): Promise<string> {
  const card = page.getByTestId('quiz-card');
  await expect(card).toBeVisible();
  const id = (await card.getAttribute('data-card-id'))!;

  if (await page.getByRole('button', { name: 'Mostra risposta' }).isVisible()) {
    await page.getByRole('button', { name: 'Mostra risposta' }).click();
  } else if ((await page.getByTestId('da-ordinare').count()) > 0) {
    while ((await page.getByTestId('da-ordinare').count()) > 0) await page.getByTestId('da-ordinare').first().click();
    await page.getByRole('button', { name: 'Conferma ordine' }).click();
  } else if (await page.getByRole('button', { name: 'Conferma', exact: true }).isVisible()) {
    await page.getByTestId('opzione').first().click();
    await page.getByRole('button', { name: 'Conferma', exact: true }).click();
  } else {
    await page.getByTestId('opzione').first().click();
  }

  await expect(page.getByTestId('feedback')).toBeVisible();
  const avanti = page.getByTestId('avanti');
  if (await avanti.isVisible()) await avanti.click();
  else if (voto === 3 && (await page.getByTestId('voto-3').isVisible())) await page.getByTestId('voto-3').click();
  else await page.getByTestId('voto-1').click();
  return id;
}

export async function freshStart(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('mode-giorno')).toBeVisible({ timeout: 30_000 });
}
