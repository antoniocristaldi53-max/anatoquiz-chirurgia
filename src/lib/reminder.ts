import { makeScheduler } from './fsrs';
import { dueCards } from './queue';
import type { AppData } from './useData';

/** Numero di card in scadenza sull'icona della Home (iOS 16.4+ da PWA installata, con permesso notifiche). */
export function updateBadge(data: AppData) {
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  if (!nav.setAppBadge) return;
  const n = dueCards({
    cards: data.cards,
    states: data.states,
    reviews: data.reviews,
    f: makeScheduler(),
    now: new Date(),
    newPerDay: data.settings.newPerDay,
    includeUnverified: data.settings.includeUnverified,
  }, new Date()).length;
  (n ? nav.setAppBadge(n) : nav.clearAppBadge?.())?.catch(() => {});
}

export function badgeSupported() {
  return 'setAppBadge' in navigator;
}

export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Evento di calendario ricorrente (ogni giorno) con avviso: funziona su iPhone senza server push. */
export function reminderIcs(time: string, appUrl: string): string {
  const [hh, mm] = time.split(':').map(Number);
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const local = (d: Date) => `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
  const s = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh || 0, mm || 0);
  const start = local(s);
  const end = local(new Date(s.getTime() + 15 * 60000));
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AnatoQuiz//IT',
    'BEGIN:VEVENT',
    `UID:anatoquiz-ripasso-${stamp}@anatoquiz`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    'RRULE:FREQ=DAILY',
    'SUMMARY:AnatoQuiz – ripasso del giorno',
    `DESCRIPTION:Apri AnatoQuiz: ${appUrl}`,
    `URL:${appUrl}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Ripasso anatomia chirurgica',
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
