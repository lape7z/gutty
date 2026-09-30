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
  insights: 'M4 19.5h16M6.5 16V11M11 16V6M15.5 16v-7M20 16v-3.5',
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
   Intensità → scala terracotta a 5 gradini (0 = nessun sintomo)
   --------------------------------------------------------------- */
export function heatLevel(score: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (score <= 0) return 0;
  return Math.min(5, Math.ceil(score / 2)) as 1 | 2 | 3 | 4 | 5;
}

export function heatStyle(score: number | undefined): CSSProperties {
  if (score === undefined) return {};
  const lv = heatLevel(score);
  return { background: `var(--heat-${lv})`, color: `var(--heat-ink-${lv})` };
}

export function intensityWord(v: number): string {
  if (v === 0) return 'assente';
  if (v <= 3) return 'lieve';
  if (v <= 6) return 'moderato';
  return 'forte';
}

export function dayMood(score: number | undefined): { title: string; line: string } {
  if (score === undefined) return { title: 'Com’è andata?', line: 'Segna sintomi e pasti: si salva tutto da solo.' };
  if (score === 0) return { title: 'Nessun sintomo', line: 'Una giornata serena.' };
  if (score < 2) return { title: 'Giornata tranquilla', line: 'Solo qualche lieve fastidio.' };
  if (score < 4) return { title: 'Qualche fastidio', line: 'Sintomi presenti ma gestibili.' };
  if (score < 6) return { title: 'Giornata pesante', line: 'Sintomi moderati.' };
  return { title: 'Giornata difficile', line: 'Sintomi forti. Annota cosa hai mangiato: servirà.' };
}

/* ---------------------------------------------------------------
   Evidenza statistica: barre crescenti + parola (mai solo colore)
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

export function SectionLabel({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="section-label">
      <h2>{title}</h2>
      {aside && <span className="aside">{aside}</span>}
    </div>
  );
}
