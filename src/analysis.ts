import { addDays } from './date';
import type { DayEntry } from './types';

/** Cosa misurare: la media di tutti i sintomi o un singolo sintomo. */
export type Target = { kind: 'overall' } | { kind: 'symptom'; id: string };

/**
 * Finestra di esposizione, in giorni prima del giorno dei sintomi.
 * {0,0} = stesso giorno, {1,1} = giorno dopo, {0,1} = stesso giorno o giorno prima.
 */
export interface LagWindow {
  from: number;
  to: number;
}

export interface AnalysisOptions {
  symptomIds: string[];
  target: Target;
  lag: LagWindow;
  /** Da questo punteggio in su la giornata conta come "brutta". */
  badThreshold?: number;
  /** Esposizioni (e non esposizioni) minime per analizzare un fattore. */
  minExposures?: number;
  permutations?: number;
  seed?: number;
}

export type Confidence = 'probabile' | 'da-verificare' | 'indizio' | 'nessuna';

export interface FactorResult {
  id: string;
  nExposed: number;
  nUnexposed: number;
  meanExposed: number;
  meanUnexposed: number;
  /** meanExposed - meanUnexposed: positivo = sintomi peggiori dopo l'esposizione. */
  diff: number;
  badRateExposed: number;
  badRateUnexposed: number;
  /** p-value bilaterale da test di permutazione. */
  pValue: number;
  /** p-value corretto per confronti multipli (Benjamini-Hochberg). */
  qValue: number;
  /** Effetto stimato tenendo conto degli altri fattori (regressione ridge). */
  netEffect: number;
  confidence: Confidence;
}

export interface AnalysisResult {
  /** Giornate utilizzabili (sintomi registrati e finestra di esposizione completa). */
  observations: number;
  meanScore: number;
  badDayRate: number;
  results: FactorResult[];
  insufficient: { id: string; nExposed: number }[];
}

export function dayScore(entry: DayEntry, symptomIds: string[], target: Target): number | undefined {
  if (target.kind === 'symptom') return entry.symptoms[target.id] ?? 0;
  if (symptomIds.length === 0) return undefined;
  const sum = symptomIds.reduce((acc, id) => acc + (entry.symptoms[id] ?? 0), 0);
  return sum / symptomIds.length;
}

/** Alimenti della giornata più i fattori di stile di vita derivati da stress e sonno. */
export function factorsOf(entry: DayEntry): string[] {
  const out = [...entry.foods];
  if (entry.stress !== undefined && entry.stress >= 4) out.push('stress-alto');
  if (entry.sleep !== undefined && entry.sleep <= 2) out.push('sonno-scarso');
  return out;
}

interface Observation {
  y: number;
  factors: Set<string>;
}

export function buildObservations(entries: DayEntry[], opts: AnalysisOptions): Observation[] {
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const obs: Observation[] = [];
  for (const outcome of entries) {
    const y = dayScore(outcome, opts.symptomIds, opts.target);
    if (y === undefined) continue;
    const factors = new Set<string>();
    let complete = true;
    for (let k = opts.lag.from; k <= opts.lag.to; k++) {
      const src = byDate.get(addDays(outcome.date, -k));
      // Senza la giornata registrata non sappiamo se c'è stata esposizione: meglio scartarla.
      if (!src) {
        complete = false;
        break;
      }
      for (const f of factorsOf(src)) factors.add(f);
    }
    if (complete) obs.push({ y, factors });
  }
  return obs;
}

/** PRNG deterministico: stessi dati, stessi risultati. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Test di permutazione sulla differenza delle medie: non assume distribuzioni normali. */
function permutationPValue(ys: number[], nExposed: number, observedDiff: number, perms: number, rand: () => number): number {
  const n = ys.length;
  const total = ys.reduce((a, b) => a + b, 0);
  const pool = ys.slice();
  const threshold = Math.abs(observedDiff) - 1e-9;
  let extreme = 0;
  for (let p = 0; p < perms; p++) {
    let sumE = 0;
    // Fisher-Yates parziale: i primi nExposed elementi formano un campione casuale.
    for (let i = 0; i < nExposed; i++) {
      const j = i + Math.floor(rand() * (n - i));
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
      sumE += pool[i];
    }
    const diff = sumE / nExposed - (total - sumE) / (n - nExposed);
    if (Math.abs(diff) >= threshold) extreme++;
  }
  return (extreme + 1) / (perms + 1);
}

/** Correzione di Benjamini-Hochberg: controlla la quota di falsi positivi quando si testano molti alimenti. */
export function benjaminiHochberg(pValues: number[]): number[] {
  const m = pValues.length;
  const order = pValues.map((p, i) => [p, i] as const).sort((a, b) => a[0] - b[0]);
  const q = new Array<number>(m);
  let running = 1;
  for (let rank = m; rank >= 1; rank--) {
    const [p, i] = order[rank - 1];
    running = Math.min(running, (p * m) / rank);
    q[i] = running;
  }
  return q;
}

/**
 * Regressione ridge con fattori binari: stima l'effetto di ogni fattore "a parità degli altri",
 * utile quando due alimenti compaiono spesso insieme (es. pizza e birra).
 */
export function ridgeEffects(obs: Observation[], factorIds: string[], lambda = 1): number[] {
  const k = factorIds.length;
  const n = obs.length;
  if (k === 0 || n === 0) return [];
  const X = obs.map((o) => factorIds.map((f) => (o.factors.has(f) ? 1 : 0)));
  const colMeans = factorIds.map((_, j) => X.reduce((acc, row) => acc + row[j], 0) / n);
  const yMean = obs.reduce((acc, o) => acc + o.y, 0) / n;

  // A = XcᵀXc + λI, b = Xcᵀyc
  const A = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const b = new Array<number>(k).fill(0);
  for (let r = 0; r < n; r++) {
    const xc = X[r].map((v, j) => v - colMeans[j]);
    const yc = obs[r].y - yMean;
    for (let i = 0; i < k; i++) {
      b[i] += xc[i] * yc;
      for (let j = i; j < k; j++) A[i][j] += xc[i] * xc[j];
    }
  }
  for (let i = 0; i < k; i++) {
    A[i][i] += lambda;
    for (let j = 0; j < i; j++) A[i][j] = A[j][i];
  }
  return solve(A, b);
}

/** Eliminazione di Gauss con pivot parziale (A è simmetrica definita positiva, quindi risolvibile). */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[pivot][c])) pivot = r;
    [M[c], M[pivot]] = [M[pivot], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let j = r + 1; j < n; j++) s -= M[r][j] * x[j];
    x[r] = s / M[r][r];
  }
  return x;
}

function confidenceOf(p: number, q: number, nExposed: number): Confidence {
  if (q < 0.1 && nExposed >= 5) return 'probabile';
  if (p < 0.05) return 'da-verificare';
  if (p < 0.2) return 'indizio';
  return 'nessuna';
}

export function analyze(entries: DayEntry[], opts: AnalysisOptions): AnalysisResult {
  const badThreshold = opts.badThreshold ?? 5;
  const minExposures = opts.minExposures ?? 3;
  const perms = opts.permutations ?? 2000;
  const rand = mulberry32(opts.seed ?? 1);

  const obs = buildObservations(entries, opts);
  const n = obs.length;
  const ys = obs.map((o) => o.y);
  const meanScore = n ? ys.reduce((a, b) => a + b, 0) / n : 0;
  const badDayRate = n ? ys.filter((y) => y >= badThreshold).length / n : 0;

  const counts = new Map<string, number>();
  for (const o of obs) for (const f of o.factors) counts.set(f, (counts.get(f) ?? 0) + 1);

  const insufficient: AnalysisResult['insufficient'] = [];
  const partial: Omit<FactorResult, 'qValue' | 'netEffect' | 'confidence'>[] = [];

  for (const [id, nExposed] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const nUnexposed = n - nExposed;
    if (nExposed < minExposures || nUnexposed < minExposures) {
      insufficient.push({ id, nExposed });
      continue;
    }
    const exposed: number[] = [];
    const unexposed: number[] = [];
    for (const o of obs) (o.factors.has(id) ? exposed : unexposed).push(o.y);
    const meanExposed = exposed.reduce((a, b) => a + b, 0) / nExposed;
    const meanUnexposed = unexposed.reduce((a, b) => a + b, 0) / nUnexposed;
    const diff = meanExposed - meanUnexposed;
    partial.push({
      id,
      nExposed,
      nUnexposed,
      meanExposed,
      meanUnexposed,
      diff,
      badRateExposed: exposed.filter((y) => y >= badThreshold).length / nExposed,
      badRateUnexposed: unexposed.filter((y) => y >= badThreshold).length / nUnexposed,
      pValue: permutationPValue(ys, nExposed, diff, perms, rand),
    });
  }

  const qValues = benjaminiHochberg(partial.map((r) => r.pValue));
  const net = ridgeEffects(
    obs,
    partial.map((r) => r.id),
  );
  const results: FactorResult[] = partial
    .map((r, i) => ({
      ...r,
      qValue: qValues[i],
      netEffect: net[i],
      confidence: confidenceOf(r.pValue, qValues[i], r.nExposed),
    }))
    .sort((a, b) => b.diff - a.diff);

  return { observations: n, meanScore, badDayRate, results, insufficient };
}
