# AnatoQuiz Chirurgia

PWA offline per ripassare l'anatomia chirurgica con ripetizione dilazionata (FSRS). Vite + React + TypeScript + Tailwind, dati in IndexedDB (Dexie), nessun backend.

## Avvio in locale
```
npm install
npm run dev        # sviluppo
npm test           # unit test (Vitest)
npm run test:e2e   # end-to-end (Playwright, viewport iPhone)
```

## Deploy
- **Cloudflare Pages**: comando di build `npm run build`, cartella di output `dist`.
- **GitHub Pages**: `VITE_BASE=/<nome-repo>/ npm run build` e pubblicazione di `dist` (script e workflow ancora da completare).

## Installazione su iPhone
Apri l'URL in Safari → Condividi → «Aggiungi alla schermata Home». Dopo la prima apertura funziona anche in modalità aereo.

## Aggiungere card
- **JSON**: file in `/content/<nn>-<distretto>.json` (array di card secondo lo schema in `src/lib/schema.ts`), oppure import da Altro → Importa.
- **Markdown**: vedi il formato commentato in `src/lib/markdown.ts` (`## id`, campi `chiave: valore`, sezioni `### Domanda`, `### Opzioni` con `- [x]`/`- [ ]`, `### Spiegazione`, `### Fonte` come `Testo | riferimento`).

## Backup
Altro → «Esporta backup completo» (card, progressi, immagini, impostazioni). Per ripristinarlo, importa lo stesso file: sostituisce tutti i dati.
