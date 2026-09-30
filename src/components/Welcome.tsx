import { MoodFace } from '../ui';

/** Schermata del primo avvio: presenta l'app con calma, un solo invito all'azione. */
export function Welcome({ onStart, onRestore, onDemo }: { onStart: () => void; onRestore: () => void; onDemo: () => void }) {
  return (
    <main className="welcome">
      <div className="center">
        <div className="welcome-mark">
          <MoodFace face="happy" size={96} stroke={4} fill="var(--card)" color="var(--primary)" />
        </div>
        <div className="brand">Gutty</div>
        <h1>Capiamo insieme la tua pancia</h1>
        <p>Un minuto al giorno per annotare sintomi e pasti. Gli schemi li cerchiamo noi.</p>
      </div>
      <div className="actions">
        <button className="btn block" onClick={onStart}>
          Iniziamo
        </button>
        <button className="btn link" onClick={onDemo}>
          Prova con dati di esempio
        </button>
        <button className="btn link" onClick={onRestore}>
          Ho già un backup
        </button>
      </div>
    </main>
  );
}
