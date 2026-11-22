# AnatoQuiz Chirurgia

App di quiz per ripassare l'**anatomia chirurgica** con ripetizione dilazionata (algoritmo FSRS).
È una web app installabile (PWA): funziona offline, anche in modalità aereo, ed è pensata prima di tutto per iPhone.
Non ha backend né login: tutti i dati restano sul dispositivo, in IndexedDB.

- 381 card iniziali su 15 distretti, tutte **da verificare** (`verificata: false`) finché non le approvi in **Revisione**.
- Tipi di domanda: scelta multipla, risposta multipla, flashcard, ordinamento, identificazione su immagine (più card di correlazione chirurgica e varianti anatomiche, riconoscibili dai tag `correlazione` e `variante`).
- Modalità: Ripasso del giorno, Flash 5 minuti, Pre-sala (per intervento, strutture a rischio per prime), Esplora per distretto (non modifica la programmazione), Punti deboli.
- Dopo ogni risposta: spiegazione, perla chirurgica e fonte.
- Statistiche: card in scadenza, serie di giorni, heatmap del richiamo per distretto, andamento a 30 giorni, tempo medio, mappa di padronanza.

---

## 1. Avvio in locale

Serve **Node.js 20 o successivo** (consigliato 22 LTS, da [nodejs.org](https://nodejs.org)).

```bash
npm install
```

```bash
npm run dev
```

Apri l'indirizzo mostrato nel terminale (di solito `http://localhost:5173`).
Per provarla dall'iPhone sulla stessa rete Wi-Fi: `npm run dev -- --host` e apri l'indirizzo di rete mostrato.
In sviluppo il service worker non è attivo: per provare l'offline usa la build (`npm run build` e poi `npm run preview`).

### Test

```bash
npm test
```

Unit test (Vitest): scheduling FSRS, coda di sessione, validazione delle card, import JSON/Markdown, backup, validità di tutti i contenuti in `/content`.

```bash
npx playwright install webkit chromium
```

```bash
npm run test:e2e
```

Test end-to-end (Playwright, profilo iPhone 13): sessione completa con card sbagliata che ricompare, pre-sala, import di 10 card con 1 malformata, backup export/cancella/reimport, sessione flash di 5 minuti in modalità offline.

---

## 2. Deploy (hosting statico gratuito)

### Cloudflare Pages (più semplice)
1. Carica il progetto su un repository GitHub.
2. Su Cloudflare: *Workers & Pages → Create → Pages → Connect to Git* e scegli il repository.
3. Impostazioni di build: comando `npm run build`, cartella di output `dist`. Nessuna variabile necessaria.

Il file `public/_headers` evita che il service worker resti in cache: gli aggiornamenti arrivano alla prima riapertura.

### GitHub Pages (metodo usato per AnatoQuiz)

L'app è pubblicata su **https://antoniocristaldi53-max.github.io/anatoquiz-chirurgia/**.
Per pubblicare una nuova versione dopo aver modificato codice o card:

```bash
npm run deploy:gh
```

Lo script compila l'app con il percorso giusto e pubblica la cartella `dist` sul branch `gh-pages` del remote `origin`
(*Settings → Pages → Source: Deploy from a branch → gh-pages / (root)*). Dopo 1–2 minuti la nuova versione è online;
sull'iPhone arriva alla successiva apertura dell'app con la rete attiva.

Per salvare su GitHub anche il codice:

```bash
git push
```

### Pubblicazione automatica con GitHub Actions (facoltativa)
In `scripts/github-pages-workflow.yml` c'è un workflow che esegue i test e pubblica a ogni push su `main`.
Per usarlo: concedi a GitHub CLI il permesso per i workflow (`gh auth refresh -h github.com -s workflow`),
sposta il file in `.github/workflows/deploy.yml` e imposta *Settings → Pages → Source: GitHub Actions*.

> Il percorso base si imposta con la variabile `VITE_BASE` (es. `/anatoquiz/`); lo script e il workflow lo calcolano da soli dal nome del repository.

---

## 3. Installazione su iPhone

1. Apri l'indirizzo dell'app in **Safari** (non in altri browser).
2. Tocca **Condividi** → **Aggiungi alla schermata Home**.
3. Apri AnatoQuiz dall'icona una volta con la rete attiva: da quel momento funziona anche offline.

Note iOS:
- L'app chiede al sistema di non cancellare i dati locali, ma iOS può comunque rimuovere i dati delle web app non usate per settimane: **fai backup regolari** (sezione 5).
- **Promemoria**: iOS non permette a una web app di programmare notifiche locali senza un server push. In *Altro → Promemoria* puoi:
  - aggiungere al Calendario un evento giornaliero con avviso (file `.ics`);
  - attivare il **badge** con il numero di card in scadenza sull'icona (iOS 16.4+, app installata, permesso notifiche).

---

## 4. Aggiungere card

Le card si possono aggiungere in tre modi:
- modificando i file JSON in `/content/` (inclusi nell'app alla build successiva);
- importando un file **JSON** o **Markdown** da *Altro → Importa* (anche incollando il testo);
- dalla schermata **Immagini** per le domande su immagine.

All'import ogni card viene validata. Quelle con errori vengono scartate e segnalate con il motivo, le altre vengono aggiunte. Una card con un `id` già presente non viene duplicata.

### 4.1 Formato JSON

Un file può contenere un array di card oppure `{ "cards": [ ... ] }`.

```json
[
  {
    "id": "vb-0100",
    "distretto": "vie-biliari",
    "argomento": "Triangolo epatocistico (di Calot)",
    "interventi": ["colecistectomia VLS"],
    "tipo": "mcq",
    "livello": 2,
    "domanda": "Quale struttura delimita in alto il triangolo epatocistico?",
    "opzioni": ["Margine inferiore del fegato", "Arteria cistica", "Coledoco"],
    "corrette": [0],
    "spiegazione": "Limiti: dotto cistico, dotto epatico comune, margine inferiore del fegato.",
    "perla": "La CVS si cerca in questo triangolo.",
    "fonte": { "testo": "Skandalakis' Surgical Anatomy", "riferimento": "cap. Extrahepatic Biliary Tract and Gallbladder" },
    "tag": ["calot", "a-rischio"],
    "verificata": false
  }
]
```

Regole:

| Campo | Note |
|---|---|
| `id` | minuscole, numeri e trattini; unico |
| `distretto` | uno di: `collo`, `parete`, `esofago`, `stomaco`, `fegato`, `vie-biliari`, `pancreas`, `milza`, `tenue`, `colon-retto`, `ano-pelvi`, `retroperitoneo`, `mammella`, `vascolare`, `laparoscopia` |
| `tipo` | `mcq`, `multi`, `flash`, `ordina`, `immagine` |
| `livello` | 1 base, 2 specializzando, 3 avanzato |
| `corrette` | indici **0-based** delle opzioni: `mcq`/`immagine` esattamente 1; `multi` almeno 1; `ordina` tutti gli indici nell'ordine giusto; `flash` il **testo** della risposta |
| `immagine` | `{ "src": "img/calot.svg", "hotspot": [{"x": 47.5, "y": 63}], "target": 0 }`, coordinate in % (0–100), `target` 0-based |
| `tag` | `a-rischio` = struttura a rischio (prima in pre-sala); `correlazione`, `variante` |

### 4.2 Formato Markdown

Ogni card inizia con `## <id>`, seguito da righe `chiave: valore` e da sezioni `###`.
Le opzioni corrette si segnano con `- [x]`, le errate con `- [ ]`.
Nelle card `ordina` scrivi l'elenco **già nell'ordine giusto**: l'app lo mescola.
`interventi` sono separati da `;`, i `tag` da `,`. Per le immagini: `punto` è 1-based, come i numeri sullo schermo.

```markdown
## collo-0100
distretto: collo
argomento: Nervo laringeo ricorrente
interventi: tiroidectomia totale; lobectomia tiroidea
tipo: mcq
livello: 1
tag: ricorrente, a-rischio

### Domanda
Attorno a quale struttura risale il nervo laringeo ricorrente sinistro?

### Opzioni
- [x] Arco aortico
- [ ] Arteria succlavia sinistra
- [ ] Arteria carotide comune sinistra

### Spiegazione
Il ricorrente sinistro gira sotto l'arco aortico, lateralmente al legamento arterioso.

### Perla
A sinistra il nervo sale più verticale nel solco tracheoesofageo.

### Fonte
Gray's Anatomy | sezione Collo

## vb-0101
distretto: vie-biliari
argomento: Critical view of safety
interventi: colecistectomia VLS
tipo: flash
livello: 1

### Domanda
Quali sono i tre criteri della critical view of safety?

### Risposta
Triangolo epatocistico liberato; terzo inferiore della colecisti staccato dal piatto cistico; due sole strutture che entrano nella colecisti.

### Spiegazione
Criteri descritti da Strasberg.

### Fonte
Strasberg SM et al. J Am Coll Surg 1995 | Analysis of biliary injury

## parete-0100
distretto: parete
argomento: Strati della parete
tipo: ordina
livello: 1

### Domanda
Ordina gli strati dall'esterno all'interno.

### Ordine
1. Aponeurosi dell'obliquo esterno
2. Obliquo interno
3. Trasverso
4. Fascia trasversale

### Spiegazione
Sotto la fascia trasversale c'è lo spazio preperitoneale.

### Fonte
Skandalakis' Surgical Anatomy | cap. Abdominal Wall and Hernias

## vb-0102
distretto: vie-biliari
argomento: Riconoscere il dotto cistico
tipo: immagine
livello: 1
immagine: img/calot.svg
hotspot: 47.5,63; 57.5,45
punto: 1

### Domanda
Cosa indica il punto evidenziato?

### Opzioni
- [x] Dotto cistico
- [ ] Dotto epatico comune

### Spiegazione
Il punto 1 è sul dotto cistico.

### Fonte
Schema originale AnatoQuiz | triangolo epatocistico
```

### 4.3 Domande su immagine

In **Immagini** puoi usare uno dei 13 schemi SVG originali inclusi oppure caricare una tua immagine (foto di un tuo schema, fotogramma di un tuo video).
Tocca l'immagine per aggiungere punti numerati; tocca un punto per selezionarlo, spostarlo, eliminarlo o sceglierlo come punto della domanda. Poi compila il modulo per creare la card.
Le immagini caricate vengono ridimensionate (lato lungo max 1600 px) e salvate nel database locale e nel backup.
Non caricare tavole di atlanti protette da copyright né immagini che permettano di identificare pazienti.

### 4.4 Aggiornare i contenuti di base
A ogni avvio l'app aggiunge le card di `/content` che non ha ancora (confronto per `id`).
Non sovrascrive mai le card già presenti, perché potresti averle modificate, e non reinserisce quelle scartate in Revisione.

---

## 5. Backup e passaggio tra dispositivi

- **Esporta**: *Altro → Esporta backup completo*. Su iPhone si apre il foglio di condivisione: scegli *Salva su File* (iCloud Drive) o inviatelo.
  Il file contiene card, progressi FSRS, cronologia delle risposte, immagini e impostazioni.
- **Ripristina**: *Altro → Importa* e scegli il file di backup. Il ripristino **sostituisce tutti i dati** del dispositivo (chiede conferma).
- **Sincronizzare** iPhone e computer: esporta da un dispositivo e importa sull'altro. Non c'è sincronizzazione automatica.
- *Esporta solo le card (JSON)* produce un file nel formato della sezione 4.1, utile per condividere o modificare le card.

---

## 6. Struttura del progetto

```
content/              card JSON per distretto (01-collo.json … 15-laparoscopia.json)
public/img/           schemi SVG originali (senza etichette)
public/icons/         icone (generate con: npm run icons)
src/lib/              logica: schema Zod, DB Dexie, FSRS, code di studio, import, Markdown, backup, statistiche
src/components/       quiz, grafici, componenti UI
src/screens/          schermate (Oggi, Sessione, Pre-sala, Esplora, Revisione, Immagini, Statistiche, Altro)
tests/unit/           Vitest
tests/e2e/            Playwright
scripts/              icone e deploy manuale
```

## 7. Note sui contenuti
- Le card sono state generate a partire da testi standard (Skandalakis, Gray, Sabiston, Chassin) e da linee guida (SAGES/multisocietaria, HerniaSurge, JGCA, Brisbane 2000). Le fonti citano capitolo o sezione, senza numeri di pagina.
- Le frequenze delle varianti sono indicate come intervallo, con la fonte.
- Gli schemi SVG sono disegni originali semplificati, non in scala, non ricalcati da atlanti.
- **Ogni card va verificata prima di fidarsi del contenuto**: usa la schermata Revisione e, se vuoi studiare solo il materiale approvato, disattiva *Altro → Includi card non verificate*.
