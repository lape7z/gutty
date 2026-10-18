import type { Food, Symptom } from './types';

export const DEFAULT_SYMPTOMS: Symptom[] = [
  { id: 'dolore', name: 'Dolore addominale' },
  { id: 'gonfiore', name: 'Gonfiore' },
  { id: 'gas', name: 'Aria / meteorismo' },
  { id: 'urgenza', name: 'Urgenza intestinale' },
];

/** Catalogo iniziale, orientato ai trigger più comuni nel colon irritabile (FODMAP e non). */
const CATALOG: Record<string, string[]> = {
  Latticini: ['Latte', 'Yogurt', 'Formaggi freschi', 'Formaggi stagionati', 'Gelato'],
  'Cereali e pane': ['Pasta di grano', 'Pane', 'Pizza', 'Prodotti integrali', 'Riso'],
  Verdure: ['Cipolla', 'Aglio', 'Legumi', 'Cavoli e broccoli', 'Funghi', 'Carciofi e asparagi', 'Verdure crude'],
  Frutta: ['Mela', 'Pera', 'Anguria e frutta estiva', 'Frutta secca', 'Frutta a guscio'],
  Bevande: ['Caffè', 'Tè', 'Bevande gassate', 'Vino', 'Birra', 'Superalcolici', 'Succhi di frutta'],
  Piatti: [],
  Altro: [
    'Fritti',
    'Piccante',
    'Dolci',
    'Cioccolato',
    'Dolcificanti (sorbitolo, xilitolo…)',
    'Carne rossa',
    'Insaccati',
    'Cibo da ristorante / pronto',
    'Pasto abbondante',
  ],
};

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const DEFAULT_FOODS: Food[] = Object.entries(CATALOG).flatMap(([category, names]) =>
  names.map((name) => ({ id: slugify(name), name, category })),
);

export const FOOD_CATEGORIES = Object.keys(CATALOG);

/**
 * Integratori e farmaci più comuni che possono influire sull'intestino. Nomi generici, non marchi.
 * Gli id hanno il prefisso "med-" per non confondersi mai con un alimento dallo stesso nome.
 */
const MED_CATALOG: Record<string, string[]> = {
  Integratori: ['Probiotici / fermenti lattici', 'Fibre (psyllium…)', 'Magnesio', 'Ferro', 'Vitamina D', 'Olio di menta piperita'],
  Farmaci: [
    'Antispastico',
    'Antidiarroico (loperamide…)',
    'Lassativo',
    'Antigas (simeticone…)',
    'Gastroprotettore / antiacido',
    'Antidolorifico (ibuprofene…)',
    'Antibiotico',
  ],
};

export function medId(name: string): string {
  return `med-${slugify(name) || Date.now()}`;
}

export const DEFAULT_MEDS: Food[] = Object.entries(MED_CATALOG).flatMap(([category, names]) =>
  names.map((name) => ({ id: medId(name), name, category, kind: 'med' as const })),
);

/** Fattori di stile di vita (stress, sonno, cena, quantità di alcol, sport), analizzati come gli alimenti. */
export const LIFESTYLE_FACTORS = {
  'stress-alto': 'Stress alto',
  'sonno-scarso': 'Dormito male',
  'cena-pesante': 'Cena abbondante o tardiva',
  'alcol-1-2': '1-2 bicchieri di alcol',
  'alcol-3-piu': '3 o più bicchieri di alcol',
  sport: 'Attività sportiva',
} as const;
