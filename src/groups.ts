import type { DayEntry, Food } from './types';

/**
 * Gruppi alimentari: l'unico modo in cui l'app classifica i cibi. Servono sia per sfogliare il menù
 * (i gruppi "da scaffale": pasta e pane, frutta, carne…) sia per l'analisi, che li confronta come
 * se fossero un unico cibo (pane, focaccia e anolini → "Pasta, pane e pizza").
 * Un cibo può stare in più gruppi: un piatto composto vale per ciò che contiene
 * (pasta al ragù → pasta, carne, pomodoro, cipolla).
 */
export interface FoodGroup {
  id: string;
  name: string;
  /** Esempi, mostrati come aiuto. */
  hint: string;
  /** Gruppo "da scaffale": compare tra le voci del menù per sfogliare i cibi. */
  shelf?: boolean;
}

export const GROUPS: FoodGroup[] = [
  // Che cibo è (gli scaffali del menù)
  { id: 'g-frumento', name: 'Pasta, pane e pizza', hint: 'con glutine: pasta, pasta ripiena, pane, pizza, focaccia, biscotti', shelf: true },
  { id: 'g-cereali', name: 'Riso, mais e patate', hint: 'riso, risotto, polenta, patate, gnocchi, quinoa', shelf: true },
  { id: 'g-verdura', name: 'Verdura', hint: 'zucchine, insalata, carote, spinaci, melanzane', shelf: true },
  { id: 'g-frutta-tutta', name: 'Frutta', hint: 'kiwi, fragole, banane, arance, mele', shelf: true },
  { id: 'g-legumi', name: 'Legumi', hint: 'fagioli, ceci, lenticchie, piselli, soia', shelf: true },
  { id: 'g-lattosio', name: 'Latte e latticini', hint: 'latte, yogurt, gelato, mozzarella, feta, ricotta', shelf: true },
  { id: 'g-stagionati', name: 'Formaggi stagionati', hint: 'parmigiano, grana, pecorino, gorgonzola', shelf: true },
  { id: 'g-carne', name: 'Carne rossa e salumi', hint: 'manzo, maiale, ragù, salsiccia, prosciutto', shelf: true },
  { id: 'g-carne-bianca', name: 'Carne bianca', hint: 'pollo, tacchino, coniglio', shelf: true },
  { id: 'g-pesce', name: 'Pesce e frutti di mare', hint: 'salmone, tonno, merluzzo, gamberi, vongole', shelf: true },
  { id: 'g-uova', name: 'Uova', hint: 'uova, frittata, pasta all’uovo, maionese', shelf: true },
  { id: 'g-guscio', name: 'Frutta a guscio e semi', hint: 'noci, mandorle, nocciole, pistacchi, arachidi', shelf: true },
  { id: 'g-dolci', name: 'Dolci e zuccheri', hint: 'dolci, cioccolato, biscotti, merendine, miele', shelf: true },
  { id: 'g-bevande', name: 'Bevande', hint: 'caffè, tè, succhi, vino, birra, bibite', shelf: true },
  // Cosa contiene che può dare fastidio
  { id: 'g-cipolla-aglio', name: 'Cipolla e aglio', hint: 'cipolla, aglio, porro, soffritto, ragù, pesto' },
  { id: 'g-verdure', name: 'Verdure che gonfiano', hint: 'cavoli, broccoli, carciofi, asparagi, funghi' },
  { id: 'g-frutta', name: 'Frutta ricca di fruttosio', hint: 'mela, pera, anguria, mango, ciliegie, succhi, miele' },
  { id: 'g-integrali', name: 'Integrali e fibre', hint: 'integrale, crusca, farro, avena, segale' },
  { id: 'g-grassi', name: 'Fritti e cibi grassi', hint: 'fritti, patatine, burro, panna, insaccati' },
  { id: 'g-pomodoro', name: 'Pomodoro e sughi', hint: 'sugo, passata, pizza, ragù' },
  { id: 'g-piccante', name: 'Piccante', hint: 'peperoncino, nduja, curry' },
  { id: 'g-polioli', name: 'Dolcificanti (polioli)', hint: 'sorbitolo, xilitolo, chewing gum, senza zucchero' },
  { id: 'g-caffeina', name: 'Caffeina', hint: 'caffè, tè, cola, energy drink' },
  { id: 'g-alcol', name: 'Alcol', hint: 'vino, birra, spritz, superalcolici' },
  { id: 'g-gassate', name: 'Bevande gassate', hint: 'bibite, acqua frizzante, birra, prosecco' },
];

const GROUP_BY_ID = new Map(GROUPS.map((g) => [g.id, g]));
export const SHELVES = GROUPS.filter((g) => g.shelf);

export function groupName(id: string): string | undefined {
  return GROUP_BY_ID.get(id)?.name;
}

export function isGroupId(id: string): boolean {
  return GROUP_BY_ID.has(id);
}

// ---------------------------------------------------------------------------------------------
// Vocabolario. Ogni voce è un inizio di parola (o di frase) del nome normalizzato; "=" chiede la
// parola esatta (per parole corte o ambigue). Le voci si sommano: "pasta al ragù" prende i gruppi
// di "pasta" e quelli di "ragù".
// ---------------------------------------------------------------------------------------------

const PASTA_SHAPES = [
  'pasta', 'spaghett', 'linguin', 'bucatin', 'rigaton', '=penne', 'pennett', 'fusill', 'farfall', 'orecchiett', 'trofie', '=trofi',
  'paccher', 'mezze maniche', 'mezzemaniche', 'tortiglion', 'conchigli', 'ditalin', 'maltagliat', 'strozzaprett', '=pici', 'bigol',
  'cavatell', 'trenett', 'vermicell', 'capellin', 'mafald', 'calamarat', 'gnocchett', 'malloredd', 'cannellon', 'scialatiell',
  'stellin', 'tempestin', 'anellin', 'risoni', 'quadrucc', 'pastin', 'ramen', '=udon', 'noodle', 'spatzle', 'spaetzle', 'canederl',
  'cous', 'couscous', 'bulgur', 'seitan', 'semola', 'farin', 'frumento', '=grano', 'glutine', 'sedanin', 'lumach', 'gramign',
  'chitarr', 'paccheri', 'fregola', 'ziti', 'candele', 'busiate', 'casarecc',
];
const EGG_PASTA = ['tagliatell', 'pappardell', 'tagliolin', 'tajarin', 'fettuccin', 'lasagn', 'garganell', 'pasta all uovo', 'pizzoccher'];
const BREAD = [
  'pane', 'panin', 'pagnott', 'rosett', 'michett', 'ciabatt', 'baguett', 'filone', 'focacc', '=pizza', '=pizze', 'pizzett', 'calzon', 'panzerott', 'piadin',
  'tigell', 'crescentin', 'erbazzone', 'cracker', 'grissin', 'tarall', 'frisell', 'fette biscottate', 'crostin', 'tramezzin', '=toast',
  'sandwich', '=pita', 'piadina', 'tortill', '=wrap', 'burrito', 'bagel', 'pancarre', 'pan carre', 'pangrattato', 'panatur', 'impanat',
  'bruschett', 'cereali', 'corn flakes', 'cornflakes', 'puccia', 'schiacciat', 'carasau', 'pane carasau',
];
const STUFFED_MEAT = ['anolin', 'tortellin', 'cappellett', 'agnolott', '=plin', 'casoncell', 'cjarson', 'marubin'];
const STUFFED_CHEESE = ['raviol', '=tortelli', '=tortello', 'tortelli d', 'tortellon', 'culurgion', 'mezzelun', 'fagottin', 'pansoti', 'sorrentin', 'cappellacc'];

const RULES: [string[], string[]][] = [
  // --- Pasta, pane, pizza
  [PASTA_SHAPES, ['g-frumento']],
  [EGG_PASTA, ['g-frumento', 'g-uova']],
  [BREAD, ['g-frumento']],
  [STUFFED_MEAT, ['g-frumento', 'g-uova', 'g-stagionati', 'g-carne']],
  [STUFFED_CHEESE, ['g-frumento', 'g-uova', 'g-lattosio', 'g-stagionati']],
  [['passatell'], ['g-frumento', 'g-uova', 'g-stagionati']],
  // Piatti e dolci che contengono farina anche se il nome non lo dice.
  [
    ['carbonara', 'amatrician', 'gricia', 'cacio e pepe', 'puttanesca', 'arrabbiat', 'hamburger', 'cheeseburger', 'burger', 'hot dog',
      'hotdog', 'kebab', 'cotolett', 'brioche', 'cornett', 'croissant', 'biscott', 'torta', '=torte', 'crostat', 'muffin', 'plumcake',
      'panettone', 'pandoro', 'colomba', 'ciambell', 'waffle', 'crepe', 'crespell', 'pancake', 'cannol', 'sfogliatell', 'savoiard',
      'pan di spagna', 'tiramisu', 'cantucc', 'krapfen', 'bombolon', 'frittell', 'chiacchier', 'cheesecake', 'pastiera', 'strudel', 'sacher',
      'wafer', 'cookie', 'brownie', 'donut', 'baba', 'bign', 'profiterol', 'merendin', 'fish and chips', 'calamari fritti', 'fritto misto',
      'tempura', 'nugget', 'cordon bleu', 'zeppol', 'castagnol', 'churros', 'gnocco fritto', 'quiche', 'focaccina', 'zuppa inglese'],
    ['g-frumento'],
  ],
  [['=crudo', 'crudo e', 'cotto e'], ['g-carne']],
  [['=gnocchi', '=gnocco di patate', 'gnocchi di patate'], ['g-frumento', 'g-cereali']],
  [['gnocco fritto', 'gnocchi fritti'], ['g-frumento', 'g-grassi']],
  [['birr', '=orzo', '=farro', 'segale', '=kamut', 'spelta'], ['g-frumento']],
  [['prodotti integrali', 'integral', 'crusca'], ['g-frumento', 'g-integrali']],
  [['=farro', 'segale', 'avena', 'porridge', 'muesli', 'granola', '=kamut', 'semi di lino', '=chia', 'psyllium', '=fibre', 'cereali integrali'], ['g-integrali']],

  // --- Riso, mais, patate
  [
    ['=riso', 'risott', '=risi', 'paella', 'sushi', 'sashimi', 'nigiri', 'uramaki', 'onigiri', 'poke', 'risi e bisi', 'arancin', 'suppli',
      'polenta', '=mais', 'popcorn', 'tortilla chips', 'nachos', 'patat', '=pure', 'pure di patate', 'quinoa', 'grano saraceno', 'amaranto',
      'miglio', 'tapioca', 'gallette di riso', 'gallette di mais', '=chips', 'crocchett', 'rosti', 'tacos', '=taco', 'riso venere',
      'riso basmati', 'cereali senza glutine', 'farina di mais', 'farina di riso'],
    ['g-cereali'],
  ],

  // --- Verdura
  [
    ['verdur', 'insalat', 'lattug', 'rucol', 'spinac', '=bieta', '=biete', 'bietol', 'zucchin', '=zucca', 'carot', 'sedan', 'finocch',
      'cetriol', 'peperon', 'melanzan', 'pomodor', 'pomodorin', 'ravanell', 'radicchio', 'indivia', 'scarol', 'cicoria', 'catalogn',
      'valerian', 'songino', 'puntarell', 'fagiolin', 'taccol', 'ortagg', 'minestron', 'caponata', 'ratatouille', 'grigliata di verdure',
      'gazpacho', 'pinzimonio', 'germogl', '=olive', '=oliva', 'contorno', 'zuppa di verdure', 'vellutat', 'crema di zucca', 'erbett',
      'cavol', 'broccol', 'verza', 'carciof', 'asparag', 'fungh', 'porcin', 'champignon', 'cime di rapa', 'friariell', 'barbabietol',
      '=rape', '=rapa', 'topinambur', 'kale', 'crauti', 'porro', '=porri', 'cipoll', 'scalogn', 'fiori di zucca', 'friggitell',
      'caprese', 'panzanella', 'pappa al pomodoro', 'peperonata', 'parmigiana', 'pasta alla norma', '=norma', 'ortolana', 'primavera'],
    ['g-verdura'],
  ],
  [
    ['cavol', 'broccol', 'verza', 'carciof', 'asparag', 'fungh', 'porcin', 'champignon', 'cime di rapa', 'friariell', 'barbabietol',
      'topinambur', 'kale', 'crauti', 'cicoria', 'cassoeula', 'pizzoccher', 'tartufo'],
    ['g-verdure'],
  ],

  // --- Frutta
  [
    ['frutta', 'frutto', 'frutti di bosco', '=mela', '=mele', '=pera', '=pere', 'anguri', 'melon', '=mango', 'ciliegi', '=pesca', '=pesche',
      'percoc', 'nettarin', 'prugn', 'susin', 'albicocc', '=fichi', '=fico', 'cachi', '=kaki', '=uva', 'uvetta', 'fragol', 'lampon',
      'mirtill', '=more', 'ribes', 'kiwi', 'banan', '=arancia', '=arance', 'mandarin', 'clementin', 'pompelm', '=limone', '=limoni',
      '=lime', 'ananas', 'papaya', '=cocco', 'litchi', 'melogran', 'frutto della passione', 'maracuja', 'avocado', 'spremut', 'macedonia',
      'frullat', 'smoothie', 'centrifugat', 'succo', 'succhi', 'datteri', 'frutta secca', 'frutta disidratata', 'mirtilli', 'nespol',
      'giuggiol', 'castagn', 'caldarrost', 'marron', 'pompelmo', 'cedro', 'kumquat', 'guava'],
    ['g-frutta-tutta'],
  ],
  [
    ['=mela', '=mele', '=pera', '=pere', 'anguri', '=mango', 'ciliegi', '=pesca', '=pesche', 'percoc', 'nettarin', 'prugn', 'susin',
      'albicocc', '=fichi', '=fico', 'cachi', '=kaki', '=more', 'datteri', 'uvetta', 'frutta secca', 'frutta disidratata', 'succo', 'succhi',
      '=miele', 'agave', 'frutta estiva', 'smoothie', 'centrifugat', 'macedonia', 'sciroppo di glucosio', 'fruttosio', 'mostarda'],
    ['g-frutta'],
  ],

  // --- Frutta a guscio
  [
    ['frutta a guscio', '=noci', '=noce', 'mandorl', 'nocciol', 'pistacch', 'anacard', 'arachid', 'noccioline', 'pinoli', '=semi',
      'burro di arachidi', 'tahin', 'granella', 'croccante', 'pasta di mandorle', 'marzapane', 'nutella', 'pesto', 'pecan', 'macadamia',
      'semi di girasole', 'semi di zucca', 'frutta secca mista'],
    ['g-guscio'],
  ],

  // --- Legumi
  [
    ['fagiol', '=ceci', 'lenticch', 'pisell', '=fave', 'soia', 'hummus', 'edamame', 'lupin', 'tofu', 'tempeh', 'legum', 'falafel',
      'pasta e fagioli', 'pasta e ceci', 'cicerch', 'borlott', 'cannellin', '=dal', '=dahl', 'minestron', 'risi e bisi', 'farinata',
      'panelle', 'cecina'],
    ['g-legumi'],
  ],

  // --- Latte e latticini freschi
  [
    ['latte', 'yogurt', 'gelat', 'panna', 'besciamell', 'mozzarell', 'burrata', 'ricott', 'stracchin', 'crescenza', '=feta', 'mascarpon',
      'formaggi fresch', 'formaggio fresc', 'fiordilatte', 'fior di latte', 'cappuccin', 'macchiat', 'milkshake', 'budin', 'tiramisu',
      'philadelphia', 'formaggio spalmabile', 'caciott', 'quark', 'squacquerone', 'robiola', 'scamorz', 'primo sale', 'kefir', 'cheesecake',
      'parmigiana', 'pizza margherita', '=margherita', 'quattro formaggi', 'lasagn', 'panna cotta', 'pannacotta', 'crema pasticcera',
      'latticin', 'fonduta', 'caprese', 'cioccolato al latte', 'stracciatella', 'sorrentina', 'cannol', 'sfogliatell', 'cassata',
      'pastiera', 'tzatziki', 'skyr', 'latte macchiato', 'frappe al', 'cordon bleu', 'mac and cheese', 'quiche', 'crepe', 'crespell',
      'pancake', 'bign', 'profiterol', 'semifreddo', 'mousse', 'gnocchi alla sorrentina', '=pizza', '=pizze', 'pizzett'],
    ['g-lattosio'],
  ],

  // --- Formaggi stagionati
  [
    ['parmigian', '=grana', 'grana padano', 'pecorin', 'formaggi stagionat', 'formaggio stagionat', 'gorgonzol', 'provolon', 'emmental',
      'fontina', 'asiago', 'cheddar', 'taleggi', 'caciocavall', 'montasio', '=brie', 'camembert', 'groviera', 'gruyere', '=edam', 'gouda',
      '=bitto', 'castelmagno', '=formaggio', '=formaggi', 'cacio e pepe', '=cacio', 'carbonara', 'amatrician', 'gricia', 'quattro formaggi',
      'pesto', 'risott', 'cheeseburger', 'fonduta', 'raclette', 'pizzoccher', 'parmigiana', 'lasagn', 'tartiflette', 'frico'],
    ['g-stagionati'],
  ],

  // --- Uova
  [
    ['=uovo', '=uova', 'frittat', 'omelette', 'carbonara', 'maionese', 'tiramisu', 'crema pasticcera', 'pan di spagna', 'savoiard',
      'crepe', 'crespell', 'pancake', '=flan', 'quiche', 'uova strapazzate', 'zabaion', 'meringh', 'tuorl', 'albume', 'frittell',
      'muffin', 'plumcake', 'vitello tonnato', 'cotoletta', 'shakshuka', 'bign', 'profiterol', 'panettone', 'pandoro', 'colomba',
      'brioche', 'cornett', 'croissant', 'torta', '=torte', 'ciambell', 'crostat', 'biscott', 'waffle', 'zuppa inglese', 'carbonara'],
    ['g-uova'],
  ],

  // --- Carne rossa e salumi
  [
    ['manzo', 'vitell', 'maial', 'carne rossa', '=ragu', 'bolognes', 'bistecc', 'hamburger', 'cheeseburger', 'burger', 'salsicc',
      'insaccat', 'salam', 'prosciutt', 'bresaol', 'speck', 'mortadell', 'wurstel', 'polpett', 'arrost', 'brasat', 'kebab', 'bollit',
      'cotechin', 'zampon', 'pancett', 'guancial', '=lardo', 'agnell', 'caprett', 'tagliata', 'fiorentina', 'carpaccio', 'porchett', 'nduja',
      'chili con carne', 'carne di manzo', 'carne di maiale', '=carne', 'spezzatin', 'gulasch', 'goulash', 'ossobuc', 'cotoletta alla milanese',
      'scaloppin', 'saltimbocca', 'involtin', '=coppa', 'culatell', 'cacciatorin', 'salamell', 'cicciol', 'hot dog', 'hotdog', 'carbonara',
      'amatrician', 'gricia', 'vitello tonnato', 'tartare', 'chorizo', 'cassoeula', 'lasagn', 'cevapcici', 'stinco', 'costin', 'braciol',
      'filetto di manzo', 'roast beef', 'cotoletta', 'capocoll', 'lonza', 'piadina prosciutto', 'pizza diavola', 'diavola', 'pizza capricciosa',
      'capricciosa', 'olive ascolane', 'pizzaiola', 'cassoeula', 'trippa', 'fegato', 'lampredott'],
    ['g-carne'],
  ],

  // --- Carne bianca
  [
    ['=pollo', 'polli', 'tacchin', 'conigli', 'faraona', 'anatra', 'petto di pollo', 'nugget', 'pollame', 'cordon bleu', 'galletto',
      'pollo arrosto', 'chicken', 'cacciatora'],
    ['g-carne-bianca'],
  ],

  // --- Pesce
  [
    ['pesce', 'salmon', '=tonno', 'merluzz', 'baccal', 'stoccafiss', 'orata', 'branzin', 'spigola', 'sogliola', 'platessa', 'trota',
      'sardin', '=alici', '=alice', 'acciug', 'sgombr', 'pesce spada', '=rombo', 'cernia', 'nasello', 'polpo', 'polpi', 'calamar', 'seppi',
      'gamber', 'scamp', 'mazzancoll', 'aragost', 'astice', 'granch', 'vongol', 'cozz', 'ostric', 'capesant', 'frutti di mare', 'sushi',
      'sashimi', 'nigiri', 'uramaki', 'poke', 'fritto misto', 'frittura di pesce', 'surimi', 'bastoncini di pesce', 'bottarga', 'totan',
      'moscardin', 'paella', 'cacciucco', 'brodetto', 'fish', 'vitello tonnato', 'pescespada', 'tartare di tonno', 'tartare di salmone',
      'baccala', 'acqua pazza', 'pesce persico', 'lucci', 'anguill', 'muscoli'],
    ['g-pesce'],
  ],

  // --- Dolci e zuccheri
  [
    ['=dolci', '=dolce', 'dolciumi', 'dessert', 'torta', '=torte', 'biscott', 'gelat', 'cioccolat', 'merendin', 'crostat', 'tiramisu',
      'caramell', 'zucchero', 'zuccher', 'nutella', 'marmellat', 'confettur', 'cornett', 'brioche', 'croissant', 'pasticcin', 'budin',
      'panettone', 'pandoro', 'colomba', 'cheesecake', 'bombolon', 'krapfen', 'churros', 'muffin', 'crespell', 'crepe', 'pancake', 'waffle',
      'cannol', 'sfogliatell', 'bign', 'panna cotta', 'pannacotta', 'meringh', 'zabaion', 'cassata', 'sbrisolona', 'cantucc', 'amarett',
      'torron', 'croccante', 'gelatin', '=miele', 'sciropp', 'barrett', 'donut', 'ciambell', 'plumcake', 'strudel', 'sacher', 'mousse',
      'semifreddo', 'sorbett', 'granita', 'ghiacciol', 'pastiera', 'zeppol', 'frittell', 'chiacchier', '=frappe', 'castagnol', 'baba',
      'profiterol', 'zuppa inglese', 'savoiard', 'crema pasticcera', 'pan di spagna', 'tartufo al cioccolato', 'cioccolata calda',
      'merenda', 'snack dolce', 'wafer', 'lecca lecca', 'marzapane', 'zucchero filato', 'brownie', 'cookie', 'macaron'],
    ['g-dolci'],
  ],

  // --- Bevande
  [
    ['caff', 'espresso', 'cappuccin', '=te', '=the', '=tea', 'tisan', 'camomill', 'infus', '=acqua', 'succo', 'succhi', 'spremut',
      'frullat', 'smoothie', 'centrifugat', 'bevand', 'bibit', '=drink', '=cola', 'coca cola', 'pepsi', 'aranciata', 'chinott', 'sprite',
      'fanta', 'gazzosa', 'tonica', 'soda', 'energy', 'red bull', 'ginseng', 'kombucha', '=mate', 'matcha', 'latte macchiato',
      'cioccolata calda', 'limonata', 'gingerino', 'crodino', 'sanbitter', 'te freddo', 'tea freddo', '=ace', 'milkshake', 'orzata',
      'vino', '=vini', 'birr', 'spritz', 'prosecc', 'champagne', 'spumant', 'superalcolic', 'grappa', 'whisky', 'vodka', '=gin', '=rum',
      '=rhum', 'amaro', 'limoncell', 'cocktail', 'aperitiv', 'mojito', 'negroni', 'sangria', '=sake', 'liquor', 'tequila', 'sidro', 'bellini',
      'mimosa', 'aperol', 'campari', 'martini', 'hugo', 'lambrusco', 'vermouth', '=mirto', 'sambuca', 'brandy', 'cognac', 'baileys',
      'gin tonic', 'cuba libre', 'moscow mule', 'margarita', 'daiquiri', 'pina colada', 'caipirinha', 'birra'],
    ['g-bevande'],
  ],

  // --- Possibili trigger
  [
    ['cipoll', '=aglio', 'scalogn', '=porro', '=porri', 'erba cipollina', 'soffritt', '=ragu', 'bolognes', '=sugo', '=sughi', 'pesto',
      'kebab', 'bruschett', 'amatrician', 'genovese', 'chili con carne', 'gazpacho', 'tzatziki', 'guacamole', 'salsa verde', 'aglio olio',
      '=aioli', 'caponata', 'peperonata', 'minestron', '=brodo', 'in brodo', 'risott', 'puttanesca', 'marinara', 'arrabbiat', 'pizzaiola',
      'vongol', 'spezzatin', 'gulasch', 'goulash', 'polpett', 'tortellini in brodo', 'anolini in brodo', 'cappelletti in brodo', 'cipolline',
      'lasagn', 'cacciatora', 'cassoeula', 'zuppa', 'dado', 'hamburger', 'burger', 'pappa al pomodoro', 'panzanella', 'cuscus', 'couscous',
      'curry', 'falafel', 'hummus', 'paella'],
    ['g-cipolla-aglio'],
  ],
  [
    ['fritt', 'frittur', 'patatin', '=chips', '=burro', 'panna', 'maionese', 'insaccat', 'salam', 'salsicc', 'mortadell', 'wurstel',
      'pancett', 'guancial', '=lardo', 'strutto', 'carbonara', 'gricia', 'kebab', 'hamburger', 'cheeseburger', 'burger', 'hot dog', 'hotdog',
      'cotolett', 'impanat', 'crocchett', 'suppli', 'arancin', 'olive ascolane', 'fast food', 'mcdonald', 'burger king', 'tempura',
      'nugget', 'churros', 'bombolon', 'krapfen', 'porchett', 'cibo da ristorante', 'fish and chips', 'gnocco fritto', 'panzerott',
      'frittell', 'zeppol', 'chiacchier', '=frappe', 'castagnol', 'fonduta', 'quattro formaggi', 'cordon bleu', 'pizza fritta', 'montanara',
      'parmigiana', 'calamari fritti', 'piadin', 'cicciol', 'cotechin', 'zampon', 'nachos', 'tartiflette', 'frico', 'raclette', 'cassoeula',
      'pastella', 'friggitell'],
    ['g-grassi'],
  ],
  [
    ['pomodor', '=sugo', '=sughi', '=ragu', 'bolognes', '=pizza', '=pizze', 'pizzett', 'passata', 'amatrician', 'bruschett', 'ketchup', 'parmigiana', 'arrabbiat',
      'pomarola', 'puttanesca', 'gazpacho', 'lasagn', 'margherita', 'marinara', 'caprese', 'pappa al pomodoro', 'panzanella', 'shakshuka',
      'chili con carne', 'caponata', '=norma', 'pizzaiola', 'cacciatora', 'gnocchi alla sorrentina', 'sorrentina', 'suppli', 'diavola',
      'capricciosa', 'cacciucco', 'peperonata', 'polpette al sugo', 'trippa'],
    ['g-pomodoro'],
  ],
  [
    ['piccant', 'peperoncin', 'nduja', 'curry', '=chili', 'arrabbiat', 'diavola', 'tabasco', 'wasabi', 'jalapen', 'sriracha', 'harissa',
      'kimchi', 'messican', '=thai', 'chorizo', 'aglio olio e peperoncino', 'paprika piccante', 'salsa piccante', 'chili con carne'],
    ['g-piccante'],
  ],
  [
    ['sorbitol', 'xilitol', 'mannitol', 'maltitol', 'eritritol', 'isomalt', 'chewing', 'gomme da masticare', 'gomma da masticare',
      'senza zucchero', 'dolcificant', 'avocado', 'mentine', 'stevia'],
    ['g-polioli'],
  ],
  [
    ['caff', 'espresso', 'cappuccin', '=te', '=the', '=tea', 'matcha', '=mate', 'energy', 'red bull', '=cola', 'coca cola', 'pepsi', 'ginseng',
      'tiramisu', 'te freddo', 'tea freddo', '=chai', 'macchiat'],
    ['g-caffeina'],
  ],
  [
    ['vino', '=vini', 'birr', 'spritz', 'prosecc', 'champagne', 'spumant', 'superalcolic', 'grappa', 'whisky', 'vodka', '=gin', '=rum',
      '=rhum', 'amaro', 'limoncell', 'cocktail', 'aperitiv', 'mojito', 'negroni', 'sangria', '=sake', 'liquor', 'tequila', 'alcol', 'sidro',
      'bellini', 'mimosa', 'aperol', 'campari', 'martini', 'hugo', 'lambrusco', 'vermouth', '=mirto', 'sambuca', 'brandy', 'cognac', 'baileys',
      'gin tonic', 'cuba libre', 'moscow mule', 'margarita', 'daiquiri', 'pina colada', 'caipirinha', 'americano alcol'],
    ['g-alcol'],
  ],
  [
    ['gassat', 'frizzant', '=cola', 'coca cola', 'aranciata', 'chinott', 'sprite', 'fanta', 'soda', 'tonica', 'birr', 'spumant', 'prosecc',
      'spritz', 'energy', 'red bull', 'pepsi', 'gazzosa', 'bibit', 'limonata', 'gingerino', 'crodino', 'sanbitter', 'champagne', 'kombucha',
      'acqua minerale gassata', 'gin tonic', 'cuba libre', 'moscow mule', 'hugo', 'mojito', 'lambrusco'],
    ['g-gassate'],
  ],
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
  ['yogurt di soia', 'g-lattosio'],
  ['yogurt vegetale', 'g-lattosio'],
  ['senza glutine', 'g-frumento'],
  ['gluten free', 'g-frumento'],
  ['pasta di mandorle', 'g-frumento'],
  ['analcolic', 'g-alcol'],
  ['decaffeinat', 'g-caffeina'],
  ['=deca', 'g-caffeina'],
  ['=orzo', 'g-caffeina'],
  ['caffe d orzo', 'g-caffeina'],
  ['frutti di mare', 'g-frutta-tutta'],
  ['fagiolin', 'g-legumi'],
  ['pizza bianca', 'g-pomodoro'],
  ['acqua naturale', 'g-gassate'],
  ['acqua liscia', 'g-gassate'],
  ['crema di zucca', 'g-lattosio'],
  ['pizzoccher', 'g-uova'],
  ['pizzoccher', 'g-pomodoro'],
  ['farina di riso', 'g-frumento'],
  ['farina di mais', 'g-frumento'],
  ['farinata', 'g-frumento'],
  ['panelle', 'g-frumento'],
  ['tortilla chips', 'g-frumento'],
  ['frutta a guscio', 'g-frutta-tutta'],
  ['fruttosio', 'g-frutta-tutta'],
  ['formaggi fresch', 'g-stagionati'],
  ['formaggio fresc', 'g-stagionati'],
  ['formaggio spalmabile', 'g-stagionati'],
  ['senza zucchero', 'g-dolci'],
  ['acqua pazza', 'g-bevande'],
  ['zuppa inglese', 'g-cipolla-aglio'],
  ['fette biscottate', 'g-uova'],
  ['frittat', 'g-grassi'],
  ['cioccolato amaro', 'g-alcol'],
  // Carne bianca, pesce o vegetale al posto della carne rossa ("cotoletta di pollo", "burger vegano").
  ['pollo arrosto', 'g-carne'],
  ['di pollo', 'g-carne'],
  ['di tacchino', 'g-carne'],
  ['di pesce', 'g-carne'],
  ['di tonno', 'g-carne'],
  ['di salmone', 'g-carne'],
  ['di soia', 'g-carne'],
  ['di seitan', 'g-carne'],
  ['di ceci', 'g-carne'],
  ['di lenticchie', 'g-carne'],
  ['vegetarian', 'g-carne'],
  ['vegan', 'g-carne'],
  ['=veg', 'g-carne'],
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

function compile(k: string): RegExp {
  const exact = k.startsWith('=');
  const word = escape(exact ? k.slice(1) : k);
  return new RegExp(`(^| )${word}${exact ? '( |$)' : ''}`);
}

const COMPILED: [RegExp, string[]][] = RULES.flatMap(([keys, groups]) => keys.map((k): [RegExp, string[]] => [compile(k), groups]));
const COMPILED_EXCLUSIONS: [RegExp, string][] = EXCLUSIONS.map(([k, g]) => [compile(k), g]);

/** Voci di una sola parola, per riconoscere anche i nomi scritti con un errore di battitura. */
const FUZZY: { key: string; exact: boolean; groups: string[] }[] = RULES.flatMap(([keys, groups]) =>
  keys
    .map((k) => ({ key: k.replace(/^=/, ''), exact: k.startsWith('='), groups }))
    // Solo voci lunghe: con parole corte un errore trasforma "pasto" in "pasta".
    .filter(({ key }) => !key.includes(' ') && key.length >= 6),
);

/** Distanza di modifica (Levenshtein) tra due parole brevi. */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** Gruppi di una parola con un errore di battitura (es. "tortelini" → come "tortellini"). */
function fuzzyGroups(word: string): string[] {
  if (word.length < 5) return [];
  for (const { key, exact, groups } of FUZZY) {
    const target = exact ? word : word.slice(0, key.length + 1);
    // Per le radici ("tortellin") confronta l'inizio della parola, con una lettera in più o in meno.
    const candidates = exact ? [target] : [word.slice(0, key.length - 1), word.slice(0, key.length), target];
    if (candidates.some((c) => c.length >= 4 && distance(c, key) <= 1)) return groups;
  }
  return [];
}

/** Gruppi suggeriti in base al nome del cibo o del piatto. */
export function suggestGroups(name: string): string[] {
  const n = normalizeName(name);
  let out: string[] = [];
  const add = (groups: string[]) => {
    for (const g of groups) if (!out.includes(g)) out.push(g);
  };
  for (const [re, groups] of COMPILED) if (re.test(n)) add(groups);
  // Nessuna parola riconosciuta: prova a correggere gli errori di battitura, parola per parola.
  if (out.length === 0) for (const w of n.split(' ')) add(fuzzyGroups(w));
  for (const [re, g] of COMPILED_EXCLUSIONS) if (re.test(n)) out = out.filter((x) => x !== g);
  // Ordine stabile, quello della lista dei gruppi.
  return GROUPS.map((g) => g.id).filter((id) => out.includes(id));
}

/** Gruppi di un cibo: quelli scelti a mano se ci sono, altrimenti quelli suggeriti dal nome. */
export function groupsOf(food: Pick<Food, 'name' | 'groups'>): string[] {
  return food.groups ?? suggestGroups(food.name);
}

/**
 * Nel menù ogni cibo sta in un solo posto, il più rappresentativo: una bevanda tra le bevande (anche
 * la birra, che contiene orzo), un dolce tra i dolci, un piatto sotto la sua base (pasta al ragù →
 * pasta). Cosa contiene davvero resta nei suoi gruppi, che sono quelli usati dall'analisi.
 */
const SHELF_PRIORITY = [
  'g-bevande', 'g-dolci', 'g-frumento', 'g-cereali', 'g-legumi', 'g-pesce', 'g-carne-bianca', 'g-carne', 'g-uova', 'g-verdura',
  'g-frutta-tutta', 'g-guscio', 'g-lattosio', 'g-stagionati',
];

/** Voce del menù in cui compare un cibo; "altro" se non è ancora classificato. */
export function shelvesOf(food: Pick<Food, 'name' | 'groups'>): string[] {
  const groups = groupsOf(food);
  const shelf = SHELF_PRIORITY.find((g) => groups.includes(g));
  return [shelf ?? 'altro'];
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
