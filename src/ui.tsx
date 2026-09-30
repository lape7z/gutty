import type { CSSProperties, ReactNode } from 'react';
import type { Confidence } from './analysis';

/* ---------------------------------------------------------------
   Icone (griglia 24, tratto 1.8 — stile coerente in tutta l'app)
   --------------------------------------------------------------- */
const PATHS = {
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  plus: 'M12 5v14M5 12h14',
  x: 'M7 7l10 10M17 7L7 17',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  download: 'M12 4v11M7 10.5l5 5 5-5M5 20h14',
  upload: 'M12 16V5M7 9.5l5-5 5 5M5 20h14',
  table: 'M4 5h16v14H4zM4 10h16M4 15h16M10 5v14',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  trash: 'M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13',
  today: 'M12 20.5c4.7 0 8.5-3.8 8.5-8.5S16.7 3.5 12 3.5 3.5 7.3 3.5 12s3.8 8.5 8.5 8.5zM12 8v8M8 12h8',
  diary: 'M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5zM4 9.5h16M8.5 2.5v3M15.5 2.5v3',
  insights: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4M8.5 11l2 2 3.5-4',
  charts: 'M4 19.5h16M5 15.5l4.5-4.5 3.5 3 6-6.5M15 7.5h4v4',
  settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM9 19.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={style}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/* ---------------------------------------------------------------
   Intensità → scala lavanda a 5 gradini (0 = nessun sintomo)
   --------------------------------------------------------------- */
/** Punteggio 0-4 → uno dei 5 gradini di colore (0 = nessun sintomo). */
export function heatLevel(score: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (score <= 0) return 0;
  return Math.min(5, Math.ceil((score * 5) / 4)) as 1 | 2 | 3 | 4 | 5;
}

const WORDS = ['Bene', 'Lieve', 'Fastidio', 'Male', 'Malissimo'];

/** La parola della faccina più vicina a un punteggio 0-4 (anche medio). */
export function levelWord(score: number): string {
  return WORDS[Math.max(0, Math.min(4, Math.round(score)))];
}

export function heatStyle(score: number | undefined): CSSProperties {
  if (score === undefined) return {};
  const lv = heatLevel(score);
  return { background: `var(--v-${lv})`, color: `var(--v-ink-${lv})` };
}

export type Face = 'hello' | 'zen' | 'happy' | 'ok' | 'meh' | 'sad' | 'awful';

export function dayMood(score: number | undefined): { title: string; line: string; face: Face } {
  if (score === undefined) return { title: 'Come stai oggi?', line: 'Annota sintomi e pasti: bastano pochi tocchi.', face: 'hello' };
  if (score === 0) return { title: 'Pancia serena', line: 'Nessun sintomo oggi. Bene così.', face: 'zen' };
  if (score < 0.8) return { title: 'Giornata tranquilla', line: 'Solo qualche lieve fastidio.', face: 'happy' };
  if (score < 1.6) return { title: 'Qualche fastidio', line: 'Sintomi leggeri, ma ci sono.', face: 'ok' };
  if (score < 2.4) return { title: 'Giornata impegnativa', line: 'Prenditi cura di te e annota cosa hai mangiato.', face: 'meh' };
  return { title: 'Giornata difficile', line: 'Ci sta. Segna tutto: aiuterà a capire perché.', face: 'sad' };
}

/* ---------------------------------------------------------------
   Faccine dell'umore
   --------------------------------------------------------------- */
/**
 * Faccina dell'umore, disegnata come le altre icone dell'app: cerchio e tratti a linea.
 * Il riempimento arriva da `fill` o dalla variabile CSS --face-fill; il tratto dal colore corrente.
 */
export function MoodFace({
  face,
  size = 24,
  stroke = 1.8,
  fill,
  color,
}: {
  face: Face;
  size?: number;
  /** Spessore del tratto in pixel, uguale a qualunque dimensione. */
  stroke?: number;
  fill?: string;
  color?: string;
}) {
  const line = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: stroke,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    vectorEffect: 'non-scaling-stroke',
  } as const;
  const eyes =
    face === 'zen' ? (
      <>
        <path d="M7.6 10.2q1.4 1.2 2.8 0" {...line} />
        <path d="M13.6 10.2q1.4 1.2 2.8 0" {...line} />
      </>
    ) : face === 'awful' ? (
      <>
        <path d="M7.8 8.6l2.2 1.4-2.2 1.4" {...line} />
        <path d="M16.2 8.6l-2.2 1.4 2.2 1.4" {...line} />
      </>
    ) : (
      <>
        <path d="M9 9v1.6" {...line} />
        <path d="M15 9v1.6" {...line} />
      </>
    );
  const mouth = {
    hello: 'M8.6 14q3.4 3 6.8 0',
    zen: 'M9.2 14.4q2.8 2.2 5.6 0',
    happy: 'M8.2 13.8q3.8 3.6 7.6 0',
    ok: 'M9.6 14.8q2.4 1.4 4.8 0',
    meh: 'M9.2 15.2h5.6',
    sad: 'M8.8 16.4q3.2-2.6 6.4 0',
    awful: 'M8 15.8q1-1 2 0t2 0 2 0 2 0',
  }[face];
  return (
    <svg className="mood-face" width={size} height={size} viewBox="0 0 24 24" aria-hidden style={color ? { color } : undefined}>
      <circle cx="12" cy="12" r="10" {...line} fill={fill ?? 'var(--face-fill, none)'} />
      {eyes}
      <path d={mouth} {...line} />
    </svg>
  );
}

/* ---------------------------------------------------------------
   Evidenza statistica: pallini + parola (mai solo colore)
   --------------------------------------------------------------- */
export const EVIDENCE: Record<Confidence, { level: number; label: string; help: string }> = {
  probabile: { level: 3, label: 'Forte', help: 'Differenza netta, che regge anche tenendo conto di quanti alimenti stai confrontando.' },
  'da-verificare': { level: 2, label: 'Media', help: 'Significativa da sola, ma tra tanti confronti potrebbe essere una coincidenza.' },
  indizio: { level: 1, label: 'Debole', help: 'Una tendenza: servono più giornate per capire se è reale.' },
  nessuna: { level: 0, label: 'Nessuna', help: 'Nessuna differenza distinguibile dal caso.' },
};

export function Evidence({ confidence }: { confidence: Confidence }) {
  const e = EVIDENCE[confidence];
  return (
    <span className="evidence" title={e.help}>
      <span className="bars" aria-hidden>
        {[1, 2, 3].map((i) => (
          <i key={i} className={i <= e.level ? 'on' : ''} />
        ))}
      </span>
      Evidenza {e.label.toLowerCase()}
    </span>
  );
}

export function signed(v: number): string {
  const s = Math.abs(v).toLocaleString('it-IT', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  return `${v > 0.049 ? '+' : v < -0.049 ? '−' : ''}${s}`;
}

export function num(v: number): string {
  return v.toLocaleString('it-IT', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
}

export function Sec({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="sec">
      <h2>{title}</h2>
      {aside !== undefined && <span className="aside">{aside}</span>}
    </div>
  );
}
