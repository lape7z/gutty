/** Una giornata registrata. La data (YYYY-MM-DD, ora locale) è la chiave primaria. */
export interface DayEntry {
  date: string;
  /** id sintomo -> intensità 0..10 */
  symptoms: Record<string, number>;
  /** Scala di Bristol 1..7 (facoltativa) */
  bristol?: number;
  /** Livello di stress 1..5 (facoltativo) */
  stress?: number;
  /** Qualità del sonno 1..5 (facoltativa) */
  sleep?: number;
  /** id degli alimenti/bevande assunti in quella giornata */
  foods: string[];
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
