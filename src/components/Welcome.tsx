import { Mascot } from '../ui';

/** Schermata del primo avvio: presenta l'app con calma, un solo invito all'azione. */
export function Welcome({ onStart, onRestore }: { onStart: () => void; onRestore: () => void }) {
  return (
    <main className="welcome">
      <div className="center">
        <Mascot face="hello" size={148} />
        <div className="brand">Gutty</div>
        <h1>Capiamo insieme la tua pancia</h1>
        <p>Un minuto al giorno per annotare sintomi e pasti. Gli schemi li cerchiamo noi.</p>
      </div>
      <div className="actions">
        <button className="btn block" onClick={onStart}>
          Iniziamo
        </button>
        <button className="btn link" onClick={onRestore}>
          Ho già un backup
        </button>
      </div>
    </main>
  );
}
