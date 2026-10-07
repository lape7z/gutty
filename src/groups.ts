import type { DayEntry, Food } from './types';

/**
 * Gruppi alimentari pensati per il colon irritabile: raccolgono cibi diversi che contengono lo
 * stesso possibile trigger (es. pane e focaccia → frumento; feta e mozzarella → lattosio).
 * Un piatto composto può stare in più gruppi (pasta al ragù → frumento, carne, soffritto, pomodoro).
 */
export interface FoodGroup {
  id: string;
  name: string;
  /** Esempi, mostrati come aiuto. */
  hint: string;
}

export const GROUPS: FoodGroup[] = [
  { id: 'g-frumento', name: 'Frumento e glutine', hint: 'pane, pasta, pizza, focaccia, biscotti' },
  { id: 'g-lattosio', name: 'Latte e latticini freschi', hint: 'latte, yogurt, gelato, mozzarella, feta, ricotta' },
  { id: 'g-stagionati', name: 'Formaggi stagionati', hint: 'parmigiano, grana, pecorino' },
  { id: 'g-cipolla-aglio', name: 'Cipolla e aglio', hint: 'cipolla, aglio, porro, soffritto, ragù' },
  { id: 'g-legumi', name: 'Legumi', hint: 'fagioli, ceci, lenticchie, piselli, soia' },
  { id: 'g-frutta', name: 'Frutta ricca di zuccheri', hint: 'mela, pera, anguria, mango, succhi, miele' },
  { id: 'g-verdure', name: 'Verdure fermentabili', hint: 'cavoli, broccoli, carciofi, asparagi, funghi' },
  { id: 'g-polioli', name: 'Dolcificanti (polioli)', hint: 'sorbitolo, xilitolo, chewing gum, senza zucchero' },
  { id: 'g-grassi', name: 'Fritti e cibi grassi', hint: 'fritti, patatine, burro, panna, insaccati' },
  { id: 'g-carne', name: 'Carne rossa e salumi', hint: 'manzo, maiale, ragù, salsiccia, salame' },
  { id: 'g-pomodoro', name: 'Pomodoro e sughi', hint: 'sugo, passata, pizza, ragù' },
  { id: 'g-piccante', name: 'Piccante', hint: 'peperoncino, nduja, curry' },
  { id: 'g-caffeina', name: 'Caffeina', hint: 'caffè, tè, cola, energy drink' },
  { id: 'g-alcol', name: 'Alcol', hint: 'vino, birra, spritz, superalcolici' },
  { id: 'g-gassate', name: 'Bevande gassate', hint: 'bibite, acqua frizzante, birra, prosecco' },
  { id: 'g-dolci', name: 'Zuccheri e dolci', hint: 'dolci, cioccolato, biscotti, merendine' },
  { id: 'g-integrali', name: 'Fibre e integrali', hint: 'integrale, crusca, segale, farro' },
];

const GROUP_BY_ID = new Map(GROUPS.map((g) => [g.id, g]));

export function groupName(id: string): string | undefined {
  return GROUP_BY_ID.get(id)?.name;
}

export function isGroupId(id: string): boolean {
  return GROUP_BY_ID.has(id);
}

/**
 * Regole: inizi di parola (o frasi) del nome normalizzato → gruppi.
 * `=` davanti alla parola chiede la corrispondenza esatta, per parole corte (es. "te").
 */
const RULES: [string[], string[]][] = [
  [
    ['pane', 'panin', 'focacc', 'pizz', 'pasta', 'spaghett', 'penne', 'fusill', 'rigaton', 'lasagn', 'tortellin', 'ravioli', 'tagliatell',
      'gnocch', 'cous', 'couscous', 'farro', 'orzo', 'seitan', 'cracker', 'grissin', 'fette biscottate', 'biscott', 'brioche', 'cornett',
      'croissant', 'crostat', 'torta', 'pancake', 'piadin', 'tramezzin', '=toast', 'bulgur', 'semola', 'frumento', '=grano', 'glutine',
      'impanat', 'cotolett', 'birr', 'taralli', 'friselle', 'crespell', 'muffin', 'panettone', 'pandoro', 'wurstel nel pane'],
    ['g-frumento'],
  ],
  [
    ['latte', 'yogurt', 'gelat', 'panna', 'besciamell', 'mozzarell', 'burrata', 'ricotta', 'stracchin', 'crescenza', 'feta', 'mascarpone',
      'formaggi fresch', 'formaggio fresc', 'fiordilatte', 'cappuccin', 'latte macchiato', 'milkshake', 'frappe', 'budin', 'tiramisu',
      'philadelphia', 'caciott', 'quark', 'squacquerone', 'robiola', 'scamorz', 'primo sale', 'kefir', 'cheesecake', 'parmigiana', 'pizz',
      'lasagn'],
    ['g-lattosio'],
  ],
  [
    ['parmigian', '=grana', 'grana padano', 'pecorin', 'formaggi stagionat', 'formaggio stagionat', 'gorgonzol', 'provolon', 'emmental',
      'fontina', 'asiago', 'cheddar', 'taleggi', 'caciocavall', 'montasio'],
    ['g-stagionati'],
  ],
  [
    ['cipoll', '=aglio', 'scalogn', 'porro', 'porri', 'erba cipollina', 'soffritt', 'ragu', '=sugo', '=sughi', 'pesto', 'kebab', 'bruschett',
      'amatrician', 'genovese', 'chili con carne', 'gazpacho', 'tzatziki', 'guacamole', 'salsa verde'],
    ['g-cipolla-aglio'],
  ],
  [
    ['fagiol', '=ceci', 'lenticch', 'pisell', '=fave', 'soia', 'hummus', 'edamame', 'lupin', 'tofu', 'legum', 'minestrone', 'falafel',
      'pasta e fagioli', 'pasta e ceci'],
    ['g-legumi'],
  ],
  [
    ['=mela', '=mele', '=pera', '=pere', 'anguria', '=mango', 'ciliegi', '=pesca', '=pesche', 'prugn', 'albicocc', '=fichi', '=fico', 'cachi',
      'succo', 'succhi', 'frutta secca', 'frutta estiva', '=miele', 'datteri', 'uvetta', 'smoothie', 'centrifugat', 'mirtill'],
    ['g-frutta'],
  ],
  [
    ['cavol', 'broccol', 'verza', 'cavolfior', 'cavoletti', 'carciof', 'asparag', 'fungh', 'porcin', 'champignon', 'cime di rapa',
      'barbabietol', 'friarielli', 'radicchio', 'topinambur'],
    ['g-verdure'],
  ],
  [
    ['sorbitol', 'xilitol', 'mannitol', 'maltitol', 'eritritol', 'chewing', 'gomme da masticare', 'gomma da masticare', 'senza zucchero',
      'dolcificant'],
    ['g-polioli'],
  ],
  [
    ['fritt', 'frittur', 'patatin', '=chips', 'burro', 'panna', 'maionese', 'insaccat', 'salam', 'salsicc', 'mortadell', 'wurstel',
      'pancetta', 'guancial', 'lardo', 'carbonara', 'kebab', 'hamburger', 'cotolett', 'impanat', 'crocchett', 'suppli', 'arancin',
      'olive ascolane', 'fast food', 'mcdonald', 'burger king', 'tempura', 'nugget', 'churros', 'bombolon', 'krapfen', 'porchetta',
      'cibo da ristorante'],
    ['g-grassi'],
  ],
  [
    ['manzo', 'vitell', 'maiale', 'carne rossa', 'ragu', 'bistecc', 'hamburger', 'salsicc', 'insaccat', 'salam', 'prosciutt',
      'bresaol', 'speck', 'mortadell', 'wurstel', 'polpett', 'arrosto', 'brasato', 'kebab', 'bollito', 'cotechin', 'pancetta', 'guancial',
      'agnello', 'tagliata', 'fiorentina', 'carpaccio', 'porchetta', 'nduja', 'chili con carne', 'lasagn', 'carne di manzo',
      'carne di maiale'],
    ['g-carne'],
  ],
  [
    ['pomodor', '=sugo', '=sughi', 'ragu', 'pizz', 'passata', 'amatrician', 'bruschett', 'ketchup', 'parmigiana', 'arrabbiat', 'pomarola',
      'puttanesca', 'gazpacho', 'lasagn', 'margherita'],
    ['g-pomodoro'],
  ],
  [
    ['piccant', 'peperoncin', 'nduja', 'curry', '=chili', 'arrabbiat', 'diavola', 'tabasco', 'wasabi', 'jalapen', 'sriracha', 'harissa'],
    ['g-piccante'],
  ],
  [
    ['caff', 'espresso', 'cappuccin', '=te', '=the', 'tea', 'matcha', '=mate', 'energy', 'red bull', '=cola', 'coca cola', 'pepsi',
      'ginseng'],
    ['g-caffeina'],
  ],
  [
    ['vino', '=vini', 'birr', 'spritz', 'prosecc', 'champagne', 'spumant', 'superalcolic', 'grappa', 'whisky', 'vodka', '=gin', '=rum',
      'amaro', 'limoncell', 'cocktail', 'aperitiv', 'mojito', 'negroni', 'sangria', '=sake', 'liquor', 'tequila', 'alcol', 'sidro', 'bellini',
      'mimosa', 'americano alcol'],
    ['g-alcol'],
  ],
  [
    ['gassat', 'frizzant', '=cola', 'coca cola', 'aranciata', 'chinott', 'sprite', 'fanta', 'soda', 'tonica', 'birr', 'spumant', 'prosecc',
      'spritz', 'energy', 'red bull', 'pepsi', 'gazzosa', 'bibit'],
    ['g-gassate'],
  ],
  [
    ['=dolci', '=dolce', 'dolciumi', 'dessert', 'torta', 'biscott', 'gelat', 'cioccolat', 'merendin', 'crostat', 'tiramisu', 'caramell', 'zucchero', 'nutella', 'marmellat',
      'cornett', 'brioche', 'pasticcin', 'budin', 'panettone', 'pandoro', 'cheesecake', 'bombolon', 'krapfen', 'churros', 'muffin',
      'crespell', 'pancake', 'waffle', 'cannol', 'sfogliatell', 'bign'],
    ['g-dolci'],
  ],
  [['integral', 'crusca', 'segale', 'farro', 'avena', 'fibre', 'muesli', 'cereali integrali'], ['g-integrali']],
];

/** Frasi che tolgono un gruppo trovato per sbaglio (es. "latte di mandorla" non ha lattosio). */
const EXCLUSIONS: [string, string][] = [
  ['senza lattosio', 'g-lattosio'],
  ['delattosat', 'g-lattosio'],
  ['latte di mandorla', 'g-lattosio'],
  ['latte di soia', 'g-lattosio'],
  ['latte di avena', 'g-lattosio'],
  ['latte di riso', 'g-lattosio'],
  ['latte di cocco', 'g-lattosio'],
  ['latte vegetale', 'g-lattosio'],
  ['bevanda vegetale', 'g-lattosio'],
  ['senza glutine', 'g-frumento'],
  ['gluten free', 'g-frumento'],
  ['analcolic', 'g-alcol'],
  ['decaffeinat', 'g-caffeina'],
  ['=deca', 'g-caffeina'],
  ['=orzo', 'g-caffeina'],
];

/** Minuscole, senza accenti né punteggiatura, con spazi singoli: "Pasta al ragù!" → "pasta al ragu". */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const COMPILED: [RegExp, string[]][] = RULES.flatMap(([keys, groups]) =>
  keys.map((k): [RegExp, string[]] => {
    const exact = k.startsWith('=');
    const word = escape(exact ? k.slice(1) : k);
    return [new RegExp(`(^| )${word}${exact ? '( |$)' : ''}`), groups];
  }),
);

const COMPILED_EXCLUSIONS: [RegExp, string][] = EXCLUSIONS.map(([k, g]) => {
  const exact = k.startsWith('=');
  const word = escape(exact ? k.slice(1) : k);
  return [new RegExp(`(^| )${word}${exact ? '( |$)' : ''}`), g];
});

/** Gruppi suggeriti in base al nome del cibo o del piatto. */
export function suggestGroups(name: string): string[] {
  const n = normalizeName(name);
  let out: string[] = [];
  for (const [re, groups] of COMPILED) if (re.test(n)) for (const g of groups) if (!out.includes(g)) out.push(g);
  for (const [re, g] of COMPILED_EXCLUSIONS) if (re.test(n)) out = out.filter((x) => x !== g);
  // Ordine stabile, quello della lista dei gruppi.
  return GROUPS.map((g) => g.id).filter((id) => out.includes(id));
}

/** Gruppi di un cibo: quelli scelti a mano se ci sono, altrimenti quelli suggeriti dal nome. */
export function groupsOf(food: Pick<Food, 'name' | 'groups'>): string[] {
  return food.groups ?? suggestGroups(food.name);
}

/** Categoria sensata per un cibo nuovo, a partire dai suoi gruppi. */
export function suggestCategory(groups: string[]): string {
  // Le bevande restano bevande anche se contengono altro (birra = frumento + alcol + bollicine).
  if (groups.some((g) => g === 'g-alcol' || g === 'g-gassate' || g === 'g-caffeina')) return 'Bevande';
  const families = new Set(
    groups.map((g) =>
      g === 'g-frumento' || g === 'g-integrali'
        ? 'Cereali e pane'
        : g === 'g-lattosio' || g === 'g-stagionati'
          ? 'Latticini'
          : g === 'g-cipolla-aglio' || g === 'g-verdure' || g === 'g-legumi'
            ? 'Verdure'
            : g === 'g-frutta'
              ? 'Frutta'
              : g === 'g-alcol' || g === 'g-gassate' || g === 'g-caffeina'
                ? 'Bevande'
                : 'Altro',
    ),
  );
  // Più famiglie insieme = piatto composto (es. pasta al ragù).
  if (families.size > 1) return 'Piatti';
  return [...families][0] ?? 'Altro';
}

/** Il diario visto per gruppi: al posto dei singoli cibi ci sono i loro gruppi (focaccia e pane → frumento). */
export function entriesByGroup(entries: DayEntry[], foods: Food[]): DayEntry[] {
  const byId = new Map(foods.map((f) => [f.id, f]));
  return entries.map((e) => ({
    ...e,
    foods: [...new Set(e.foods.flatMap((id) => (byId.has(id) ? groupsOf(byId.get(id)!) : suggestGroups(id.replace(/-/g, ' ')))))],
  }));
}

/** Il cibo è una bevanda alcolica? */
export function isAlcoholic(food: Pick<Food, 'name' | 'groups'> | undefined): boolean {
  return !!food && groupsOf(food).includes('g-alcol');
}

/**
 * Bicchieri di alcol di una giornata per i grafici: quelli indicati; se non indicati, 0 quando la
 * giornata ha cibi segnati e nessuna bevanda alcolica; altrimenti sconosciuto.
 */
export function drinksOf(entry: DayEntry, foodById: Map<string, Food>): number | undefined {
  if (entry.drinks !== undefined) return entry.drinks;
  if (entry.foods.length === 0) return undefined;
  return entry.foods.some((id) => isAlcoholic(foodById.get(id))) ? undefined : 0;
}
