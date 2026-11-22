import { useState } from 'react';
import { Button, downloadFile, Field, inputCls, nRisposte, Panel, Pill, Screen } from '../components/ui';
import { backupFilename, exportBackup, restoreBackup, wipeAll } from '../lib/backup';
import { saveSettings } from '../lib/db';
import { importCards, parseImportText, type ImportReport } from '../lib/importer';
import { badgeSupported, isStandalone, reminderIcs, updateBadge } from '../lib/reminder';
import type { AppData } from '../lib/useData';

/** Su iPhone usa il foglio di condivisione (Salva su File); altrove scarica il file. */
async function saveFile(name: string, text: string, type: string) {
  const file = new File([text], name, { type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (/iPhone|iPad/.test(navigator.userAgent) && nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  downloadFile(name, text, type);
}

function Report({ r }: { r: ImportReport }) {
  return (
    <div className="space-y-2 text-sm" data-testid="report-import">
      <div className="flex flex-wrap gap-2">
        <Pill tone="good">{r.aggiunte.length} aggiunte</Pill>
        <Pill>{r.duplicate.length} già presenti</Pill>
        <Pill tone={r.errori.length ? 'bad' : 'muted'}>{r.errori.length} con errori</Pill>
      </div>
      {r.duplicate.length > 0 && <p className="text-muted">Saltate perché l'id esiste già: {r.duplicate.join(', ')}</p>}
      {r.errori.map((e, i) => (
        <div key={i} className="rounded-xl border border-bad/40 bg-bad/10 p-3" data-testid="errore-import">
          <div className="font-semibold text-bad">
            Card n. {e.posizione}
            {e.id ? ` (${e.id})` : ''}
          </div>
          <ul className="mt-1 list-disc pl-5">
            {e.motivi.map((m, j) => (
              <li key={j}>{m}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function Impostazioni({ data }: { data: AppData }) {
  const s = data.settings;
  const [report, setReport] = useState<ImportReport | null>(null);
  const [msg, setMsg] = useState('');
  const [paste, setPaste] = useState('');
  const [showPaste, setShowPaste] = useState(false);

  const handleText = async (text: string, name: string) => {
    setReport(null);
    setMsg('');
    const parsed = parseImportText(text, name);
    if (parsed.kind === 'backup') {
      if (!confirm(`"${name}" è un backup completo (${parsed.backup.cards.length} card, ${nRisposte(parsed.backup.reviews.length)}). Sostituisce TUTTI i dati attuali. Continuare?`)) return;
      try {
        const r = await restoreBackup(parsed.backup);
        setMsg(`Backup ripristinato: ${r.cards} card, ${nRisposte(r.reviews)}.`);
      } catch (e) {
        setMsg(`Ripristino non riuscito: ${(e as Error).message}`);
      }
      return;
    }
    setReport(await importCards(parsed.items, parsed.preErrors));
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    await handleText(await file.text(), file.name);
  };

  return (
    <Screen title="Altro">
      <div className="space-y-4">
        <Panel className="space-y-3">
          <h2 className="text-lg font-bold">Backup</h2>
          <p className="text-sm text-muted">
            Il backup contiene card, progressi FSRS, cronologia, immagini e impostazioni. Salvalo su File/iCloud: è anche il modo per passare i dati
            da un dispositivo all'altro.
          </p>
          <Button
            big
            variant="primary"
            className="w-full"
            data-testid="esporta"
            onClick={async () => saveFile(backupFilename(), JSON.stringify(await exportBackup()), 'application/json')}
          >
            Esporta backup completo
          </Button>
          <Button
            className="w-full"
            onClick={() => saveFile('anatoquiz-card.json', JSON.stringify(data.cards, null, 2), 'application/json')}
          >
            Esporta solo le card (JSON)
          </Button>
        </Panel>

        <Panel className="space-y-3">
          <h2 className="text-lg font-bold">Importa</h2>
          <p className="text-sm text-muted">
            File <b>.json</b> (elenco di card o backup completo) oppure <b>.md</b> nel formato Markdown strutturato. Le card vengono validate; quelle con id
            già presente non vengono duplicate.
          </p>
          <label className="block">
            <span className="sr-only">Scegli file</span>
            <input
              data-testid="file-import"
              type="file"
              accept=".json,.md,.markdown,.txt,application/json,text/markdown,text/plain"
              className="block w-full text-sm file:mr-3 file:min-h-12 file:rounded-xl file:border-0 file:bg-accent file:px-4 file:font-semibold file:text-accent-fg"
              onChange={(e) => {
                onFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          <Button variant="ghost" onClick={() => setShowPaste((v) => !v)}>
            {showPaste ? 'Chiudi' : 'Oppure incolla il testo'}
          </Button>
          {showPaste && (
            <div className="space-y-2">
              <textarea className={`${inputCls} h-40 font-mono text-sm`} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="JSON o Markdown…" />
              <Button className="w-full" disabled={!paste.trim()} onClick={() => handleText(paste, paste.trim().startsWith('#') ? 'incollato.md' : 'incollato.json')}>
                Importa testo
              </Button>
            </div>
          )}
          {msg && <p className="rounded-xl bg-surface2 p-3 text-sm" data-testid="msg-import">{msg}</p>}
          {report && <Report r={report} />}
        </Panel>

        <Panel className="space-y-4">
          <h2 className="text-lg font-bold">Studio</h2>
          <Field label={`Nuove card al giorno: ${s.newPerDay}`}>
            <input type="range" min={0} max={50} step={1} value={s.newPerDay} onChange={(e) => saveSettings({ newPerDay: +e.target.value })} className="w-full accent-[var(--accent)]" />
          </Field>
          <Field label={`Richiamo desiderato (FSRS): ${Math.round(s.retention * 100)}%`} hint="Più alto = ripassi più frequenti. 90% è il valore consigliato.">
            <input type="range" min={0.8} max={0.97} step={0.01} value={s.retention} onChange={(e) => saveSettings({ retention: +e.target.value })} className="w-full accent-[var(--accent)]" />
          </Field>
          <label className="flex min-h-12 items-center justify-between gap-3">
            <span>
              Includi card non verificate
              <span className="block text-xs text-muted">Le card generate partono non verificate finché non le approvi in Revisione.</span>
            </span>
            <input type="checkbox" className="size-6 accent-[var(--accent)]" checked={s.includeUnverified} onChange={(e) => saveSettings({ includeUnverified: e.target.checked })} />
          </label>
          <label className="flex min-h-12 items-center justify-between gap-3">
            <span>Tema scuro</span>
            <input type="checkbox" className="size-6 accent-[var(--accent)]" checked={s.theme === 'dark'} onChange={(e) => saveSettings({ theme: e.target.checked ? 'dark' : 'light' })} />
          </label>
        </Panel>

        <Panel className="space-y-3">
          <h2 className="text-lg font-bold">Promemoria</h2>
          <p className="text-sm text-muted">
            iOS non permette a una web app di programmare notifiche locali senza un server push. Le due opzioni affidabili sono: un evento ricorrente nel
            Calendario con avviso, e il numero di card in scadenza sull'icona (badge).
          </p>
          <Field label="Ora del promemoria">
            <input type="time" className={inputCls} value={s.reminderTime} onChange={(e) => saveSettings({ reminderTime: e.target.value })} />
          </Field>
          <Button className="w-full" onClick={() => downloadFile('anatoquiz-promemoria.ics', reminderIcs(s.reminderTime, location.href.split('#')[0]), 'text/calendar')}>
            Aggiungi promemoria giornaliero al Calendario
          </Button>
          {badgeSupported() ? (
            <label className="flex min-h-12 items-center justify-between gap-3">
              <span>
                Badge sull'icona con le card in scadenza
                <span className="block text-xs text-muted">{isStandalone() ? 'Richiede il permesso per le notifiche.' : 'Disponibile dopo l\'installazione sulla schermata Home.'}</span>
              </span>
              <input
                type="checkbox"
                className="size-6 accent-[var(--accent)]"
                checked={s.badge}
                onChange={async (e) => {
                  const on = e.target.checked;
                  if (on && 'Notification' in window && Notification.permission !== 'granted') {
                    const p = await Notification.requestPermission();
                    if (p !== 'granted') return setMsg('Permesso notifiche negato: il badge non può essere mostrato.');
                  }
                  await saveSettings({ badge: on });
                  if (on) updateBadge(data);
                  else (navigator as Navigator & { clearAppBadge?: () => Promise<void> }).clearAppBadge?.();
                }}
              />
            </label>
          ) : (
            <p className="text-xs text-muted">Badge sull'icona non supportato da questo browser.</p>
          )}
        </Panel>

        <Panel className="space-y-3">
          <h2 className="text-lg font-bold">Installazione su iPhone</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Apri l'app in Safari.</li>
            <li>Tocca Condividi → «Aggiungi alla schermata Home».</li>
            <li>Apri AnatoQuiz dall'icona: funziona anche offline e in modalità aereo.</li>
          </ol>
          <p className="text-sm text-muted">Stato: {isStandalone() ? 'installata ✓' : 'aperta nel browser'} · {data.cards.length} card · {nRisposte(data.reviews.length)} registrate</p>
        </Panel>

        <Panel className="space-y-3">
          <h2 className="text-lg font-bold text-bad">Zona pericolosa</h2>
          <Button
            variant="danger"
            className="w-full"
            data-testid="cancella-tutto"
            onClick={async () => {
              if (!confirm('Cancellare TUTTI i dati locali (card, progressi, immagini)? Fai prima un backup. L\'operazione non è reversibile.')) return;
              await wipeAll();
              setMsg('Dati cancellati. Al prossimo avvio verrà ricaricato il set di card di base.');
            }}
          >
            Cancella tutti i dati
          </Button>
        </Panel>
        <p className="pb-4 text-center text-xs text-muted">AnatoQuiz Chirurgia · v{__APP_VERSION__}</p>
      </div>
    </Screen>
  );
}
