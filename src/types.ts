export type Meal = 'colazione' | 'pranzo' | 'cena' | 'fuoripasto';
export type Moment = 'mattina' | 'pomeriggio' | 'sera';

/** Come è andata la pancia in un momento della giornata. */
export interface MomentLog {
  /** 0 = bene … 4 = molto male */
  level: number;
  /** id dei sintomi presenti in quel momento */
  symptoms: string[];
}

/** Una giornata registrata. La data (YYYY-MM-DD, ora locale) è la chiave primaria. */
export interface DayEntry {
  date: string;
  /** Dettagli facoltativi: id sintomo -> intensità 0..10 sull'intera giornata */
  symptoms: Record<string, number>;
  /** Registrazione rapida per momento ("Sera" comprende la notte). */
  moments?: Partial<Record<Moment, MomentLog>>;
  /** Scala di Bristol 1..7 (facoltativa) */
  bristol?: number;
  /** Livello di stress 1..5 (facoltativo) */
  stress?: number;
  /** Qualità del sonno 1..5 (facoltativa) */
  sleep?: number;
  /** id degli alimenti/bevande assunti in quella giornata (unione di tutti i pasti) */
  foods: string[];
  /** Alimenti divisi per pasto. I diari più vecchi hanno solo `foods`. */
  meals?: Partial<Record<Meal, string[]>>;
  /** Cena abbondante o tardiva */
  bigDinner?: boolean;
  notes?: string;
  updatedAt: number;
}

export interface Food {
  id: string;
  name: string;
  category: string;
  archived?: boolean;
}

export interface Symptom {
  id: string;
  name: string;
  archived?: boolean;
}
