# Gutty – diario del colon irritabile

App web (installabile sul telefono come PWA) per tenere traccia giorno per giorno di:

- **come va la pancia in tre momenti** (mattina, pomeriggio, sera e notte), con un tocco ciascuno e, se vuoi, quali sintomi
- **intensità dei singoli sintomi** da 0 a 10, come dettaglio facoltativo
- **scala di Bristol** per le feci
- **alimenti e bevande** divisi per pasto: colazione, pranzo, cena, fuori pasto (catalogo iniziale orientato ai trigger FODMAP, estendibile), più "cena abbondante o tardiva"
- **stress, qualità del sonno** e note libere

…e poi **cercare correlazioni** tra ciò che mangi e come stai.

## Privacy

Tutti i dati restano nel browser del dispositivo (IndexedDB): niente account, niente server.
Da *Impostazioni* puoi esportare un backup JSON (per spostare i dati o conservarli) o un CSV da aprire in Excel.

## Come funziona l'analisi

Per ogni alimento (o fattore come “stress alto” e “dormito male”) l'app confronta il punteggio dei sintomi
nei giorni **con** e **senza** quel fattore, in una finestra temporale a scelta. Quella predefinita, **nelle 24 ore dopo**, confronta i cibi di un giorno con i sintomi
di quel pomeriggio, di quella sera e notte e della mattina dopo: così la cena conta per la notte e il risveglio, non per la mattina
dello stesso giorno. Ci sono anche le finestre a giorni interi (stesso giorno, giorno dopo, entro un giorno, due giorni dopo).
Molti trigger del colon irritabile agiscono con 6–24 ore di ritardo.

- **Diff.** – differenza del punteggio medio (0–10) tra giorni con e senza.
- **Netto** – effetto stimato *a parità degli altri alimenti* (regressione ridge), utile quando due cibi vanno spesso insieme.
- **Evidenza** – test di permutazione (nessuna ipotesi sulla distribuzione) con correzione di Benjamini-Hochberg
  per i confronti multipli: con 40 alimenti, qualche “correlazione” esce anche per puro caso.

Servono almeno 3–4 settimane di registrazioni costanti perché i risultati diventino affidabili.
Correlazione non è causa: usali come ipotesi da verificare con una dieta di esclusione, meglio se seguito da un gastroenterologo o un dietista.

Per provarla subito: *Impostazioni → Carica dati di esempio* (120 giorni con trigger nascosti: cipolla il giorno dopo, latte lo stesso giorno, stress).

## Sviluppo

```bash
npm install
npm run dev       # server di sviluppo su http://localhost:5173
npm test          # test del motore di analisi
npm run build     # build di produzione in dist/
npm run build:single  # un unico file HTML autosufficiente in dist-single/ (anteprima, senza service worker)
```

Stack: React + TypeScript + Vite, Dexie (IndexedDB), vite-plugin-pwa. Font Plus Jakarta Sans incluso nel bundle (funziona offline).
Nessuna libreria di grafici né di componenti: SVG/CSS scritti a mano, con palette verificata per il daltonismo e tema chiaro/scuro.

```
src/
  analysis.ts        motore statistico (puro, testato)
  db.ts              database locale, backup/import
  defaults.ts        sintomi e alimenti iniziali
  demo.ts            generatore di dati di esempio
  ui.tsx             icone, scala di colore dell'intensità, componenti condivisi
  components/        schermate Oggi, Diario, Analisi, Impostazioni e grafici
```

## Pubblicazione

Il workflow `.github/workflows/deploy.yml` esegue test e build a ogni push e pubblica su GitHub Pages i push su `main`.
Va attivato una volta da *Settings → Pages → Source: GitHub Actions*. L'app sarà su `https://<utente>.github.io/gutty/`;
dal telefono: apri il link e “Aggiungi a schermata Home”.
