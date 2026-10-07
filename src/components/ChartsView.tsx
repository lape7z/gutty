import { useMemo, useState, type ReactNode } from 'react';
import { MOMENTS } from '../analysis';
import { addDays, daysBetween, todayISO } from '../date';
import { MOMENT_INFO } from '../day';
import { overallScore, useActiveSymptoms, useDays, useFactorNames, useFoods } from '../hooks';
import { bristolCounts, byDrinks, byLevel, bySport, byMoment, byWeekday, inRange, symptomFrequency, type Bucket } from '../stats';
import { levelWord, num } from '../ui';
import { ColumnChart, RowChart, type BarItem } from './Bars';
import { TrendChart, type TrendPoint } from './TrendChart';

const RANGES: { key: string; label: string; days: number | undefined }[] = [
  { key: '30', label: '30 giorni', days: 30 },
  { key: '90', label: '90 giorni', days: 90 },
  { key: 'all', label: 'Tutto', days: undefined },
];

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const WEEKDAYS_LONG = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
const BRISTOL = ['Nessuna', 'Grumi duri', 'Salsiccia grumosa', 'Salsiccia screpolata', 'Liscia e morbida', 'Pezzi morbidi', 'Poltiglia', 'Liquida'];

/** Differenza minima (sulla scala 0-4) perché valga la pena dire "questo è peggio". */
const NOTABLE = 0.3;

function levelDetail(label: string, b: Bucket, unit: string): string {
  if (b.mean === undefined) return `${label}: ancora nessun dato`;
  return `${label}: in media ${levelWord(b.mean).toLowerCase()} (${num(b.mean)}) · ${b.n} ${unit}`;
}

function levelItems(labels: string[], buckets: Bucket[], unit: string, longLabels = labels): BarItem[] {
  return buckets.map((b, i) => ({ key: labels[i], label: labels[i], value: b.mean, detail: levelDetail(longLabels[i], b, unit) }));
}

/** Indice del gruppo peggiore, solo se si distingue davvero dagli altri. */
function worstOf(buckets: Bucket[], minN = 2): number | undefined {
  const ok = buckets.map((b, i) => ({ b, i })).filter(({ b }) => b.mean !== undefined && b.n >= minN);
  if (ok.length < 2) return undefined;
  ok.sort((a, b) => b.b.mean! - a.b.mean!);
  return ok[0].b.mean! - ok[ok.length - 1].b.mean! >= NOTABLE ? ok[0].i : undefined;
}

/** Media complessiva di più gruppi, pesata sul numero di giornate di ciascuno. */
function pooled(b: Bucket[], idx: number[]): number | undefined {
  const n = idx.reduce((a, i) => a + (b[i].mean === undefined ? 0 : b[i].n), 0);
  return n ? idx.reduce((a, i) => a + (b[i].mean === undefined ? 0 : b[i].mean! * b[i].n), 0) / n : undefined;
}

function Card({ title, takeaway, children, foot }: { title: string; takeaway: ReactNode; children: ReactNode; foot?: ReactNode }) {
  return (
    <section className="sheet chart-card">
      <h2>{title}</h2>
      <p className="takeaway">{takeaway}</p>
      {children}
      {foot && <p className="chart-foot">{foot}</p>}
    </section>
  );
}

export function ChartsView() {
  const days = useDays();
  const symptoms = useActiveSymptoms();
  const nameOf = useFactorNames();
  const foods = useFoods();
  const [rangeKey, setRangeKey] = useState('30');
  const today = todayISO();
  const range = RANGES.find((r) => r.key === rangeKey)!;
  const ids = symptoms.map((s) => s.id);

  const entries = useMemo(() => inRange(days ?? [], today, range.days), [days, today, range.days]);

  const points = useMemo(() => {
    const map = new Map<string, TrendPoint>();
    for (const d of entries) map.set(d.date, { date: d.date, value: overallScore(d, symptoms), detail: d.foods.length ? d.foods.slice(0, 4).map(nameOf).join(', ') : undefined });
    return map;
  }, [entries, symptoms, nameOf]);

  if (!days) return null;

  const scored = entries.filter((d) => overallScore(d, symptoms) !== undefined);
  const spanDays =
    range.days ?? Math.max(14, days.length ? daysBetween(days[0].date, today) + 1 : 14);

  const header = (
    <>
      <header className="page-title">
        <div className="kicker">
          {scored.length} {scored.length === 1 ? 'giornata' : 'giornate'} con sintomi segnati
        </div>
        <h1>Grafici</h1>
        <p>Tocca una barra o un punto per vedere i dettagli.</p>
      </header>
      <div className="pills range-pills" role="group" aria-label="Periodo">
        {RANGES.map((r) => (
          <button key={r.key} className="pill" aria-pressed={rangeKey === r.key} onClick={() => setRangeKey(r.key)}>
            {r.label}
          </button>
        ))}
      </div>
    </>
  );

  if (scored.length < 3) {
    return (
      <>
        {header}
        <p className="note" style={{ marginTop: 16 }}>
          Servono almeno tre giornate con i sintomi segnati in questo periodo per disegnare i grafici. Intanto continua a
          compilare “Oggi”: bastano pochi tocchi al giorno.
        </p>
      </>
    );
  }

  // --- Andamento
  const first = scored.slice(0, Math.ceil(scored.length / 2));
  const second = scored.slice(Math.ceil(scored.length / 2));
  const meanOf = (list: typeof scored) => list.reduce((a, d) => a + overallScore(d, symptoms)!, 0) / list.length;
  const trendDelta = meanOf(second) - meanOf(first);
  const trendText =
    scored.length < 8
      ? 'Con qualche giorno in più si vedrà la tendenza.'
      : trendDelta <= -NOTABLE
        ? 'Stai migliorando: la seconda metà del periodo va meglio della prima.'
        : trendDelta >= NOTABLE
          ? 'Ultimamente va un po’ peggio rispetto all’inizio del periodo.'
          : 'Nel complesso stabile in questo periodo.';

  // --- Momenti
  const moments = byMoment(entries);
  const momentBuckets = MOMENTS.map((m) => moments[m]);
  const worstMoment = worstOf(momentBuckets);
  const momentLabels = MOMENT_INFO.map((m) => m.label);

  // --- Settimana
  const weekday = byWeekday(entries, ids);
  const worstDay = worstOf(weekday);

  // --- Sintomi
  const freq = symptomFrequency(entries, ids);
  const nameOfSymptom = (id: string) => symptoms.find((s) => s.id === id)?.name ?? id;
  const topSymptom = freq[0];

  // --- Feci
  const bristol = bristolCounts(entries);
  const bristolTotal = bristol.reduce((a, b) => a + b, 0);
  const normal = bristol[3] + bristol[4] + bristol[5];
  const hard = bristol[0] + bristol[1] + bristol[2];
  const loose = bristol[6] + bristol[7];

  // --- Stress e sonno
  const stress = byLevel(entries, ids, 'stress');
  const sleep = byLevel(entries, ids, 'sleep');
  const compare = (b: Bucket[], lowIdx: number[], highIdx: number[]) => ({ low: pooled(b, lowIdx), high: pooled(b, highIdx) });
  const st = compare(stress, [0, 1], [3, 4]);
  const sl = compare(sleep, [0, 1], [3, 4]);

  // --- Sport
  const sport = bySport(entries, ids);
  const sportDays = entries.filter((e) => e.sport?.length && overallScore(e, symptoms) !== undefined).length;
  const withSport = pooled(sport, [1, 2, 3]);
  const bestTime = [1, 2, 3].filter((i) => sport[i].n >= 2).sort((a, b) => sport[a].mean! - sport[b].mean!)[0];
  const sportText =
    sportDays === 0
      ? 'Ancora nessuna attività sportiva segnata in questo periodo.'
      : sport[0].mean === undefined || withSport === undefined
        ? 'Servono anche giornate senza sport per fare il confronto.'
        : sportDays < 4
          ? 'Ancora poche giornate con sport per un confronto.'
          : sport[0].mean - withSport >= NOTABLE
            ? `Nei giorni con sport i sintomi sono in media ${num(withSport)}, senza ${num(sport[0].mean)}${
                bestTime !== undefined ? `; va meglio quando lo fai ${['la mattina', 'il pomeriggio', 'la sera'][bestTime - 1]}` : ''
              }.`
            : withSport - sport[0].mean >= NOTABLE
              ? `Nei giorni con sport i sintomi sono un po’ più alti: ${num(withSport)} contro ${num(sport[0].mean)}.`
              : 'Per ora lo sport non sembra cambiare molto i sintomi.';

  // --- Alcol: 0, 1-2 e 3 o più bicchieri, sintomi nelle 24 ore dopo
  const drinks = byDrinks(entries, days ?? [], ids, foods);
  const al = { none: pooled(drinks, [0]), few: pooled(drinks, [1, 2]), many: pooled(drinks, [3, 4, 5]) };
  const drinkDays = drinks.slice(1).reduce((a, b) => a + b.n, 0);
  const drinksText =
    drinkDays === 0
      ? 'Ancora nessuna giornata con bicchieri di alcol segnati in questo periodo.'
      : al.none === undefined
        ? 'Servono anche giornate senza alcol per fare il confronto.'
        : al.many !== undefined && al.many - al.none >= NOTABLE
          ? `Con 3 o più bicchieri i sintomi nelle 24 ore dopo sono in media ${num(al.many)}, senza alcol ${num(al.none)}${
              al.few !== undefined ? `; con 1-2 bicchieri ${num(al.few)}` : ''
            }.`
          : al.few !== undefined && al.few - al.none >= NOTABLE
            ? `Già con 1-2 bicchieri i sintomi nelle 24 ore dopo salgono: in media ${num(al.few)} contro ${num(al.none)} senza alcol.`
            : drinkDays < 4
              ? 'Ancora poche giornate con alcol per capire se la quantità conta.'
              : 'Per ora la quantità di alcol non sembra cambiare molto i sintomi.';

  return (
    <>
      {header}

      <Card title="Andamento" takeaway={trendText}>
        <TrendChart points={points} end={today} days={spanDays} />
      </Card>

      <Card
        title="Momenti della giornata"
        takeaway={
          worstMoment === undefined
            ? 'Nessun momento spicca sugli altri.'
            : `Di solito va peggio ${worstMoment === 2 ? 'la sera e di notte' : `il ${momentLabels[worstMoment].toLowerCase()}`}.`
        }
      >
        <ColumnChart
          label="Media per momento della giornata"
          items={levelItems(momentLabels, momentBuckets, 'momenti segnati')}
          max={4}
          format={num}
        />
      </Card>

      <Card
        title="Giorni della settimana"
        takeaway={worstDay === undefined ? 'Nessun giorno della settimana si distingue.' : `Il giorno più pesante è il ${WEEKDAYS_LONG[worstDay]}.`}
        foot="Media della giornata, da 0 (bene) a 4 (malissimo)."
      >
        <ColumnChart
          label="Media per giorno della settimana"
          items={levelItems(WEEKDAYS, weekday, 'giornate', WEEKDAYS_LONG.map((d) => d.charAt(0).toUpperCase() + d.slice(1)))}
          max={4}
          format={num}
        />
      </Card>

      <Card
        title="Sintomi più frequenti"
        takeaway={
          !topSymptom || topSymptom.count === 0
            ? 'Nessun sintomo segnato nei momenti di questo periodo.'
            : `Il più frequente è ${nameOfSymptom(topSymptom.id).toLowerCase()}: c’è nel ${Math.round(topSymptom.share * 100)}% dei momenti segnati.`
        }
        foot={topSymptom ? `Su ${topSymptom.total} momenti segnati.` : undefined}
      >
        <RowChart
          rows={freq.map((f) => ({
            key: f.id,
            label: nameOfSymptom(f.id),
            share: f.share,
            detail: `${nameOfSymptom(f.id)}: ${f.count} momenti su ${f.total}`,
          }))}
        />
      </Card>

      <Card
        title="Feci"
        takeaway={
          bristolTotal === 0
            ? 'Nessuna scala di Bristol segnata in questo periodo.'
            : `${Math.round((normal / bristolTotal) * 100)}% nella norma (tipi 3-5), ${Math.round((hard / bristolTotal) * 100)}% verso la stitichezza, ${Math.round((loose / bristolTotal) * 100)}% verso la diarrea.`
        }
        foot="“No” = giornate senza evacuazione."
      >
        <ColumnChart
          label="Giornate per tipo di feci"
          caption={['stitichezza', 'diarrea']}
          items={bristol.map((count, i) => ({
            key: String(i),
            label: i === 0 ? 'No' : String(i),
            value: count,
            detail: `${i === 0 ? 'Nessuna evacuazione' : `Tipo ${i} · ${BRISTOL[i]}`}: ${count} ${count === 1 ? 'giornata' : 'giornate'}`,
          }))}
          max={Math.max(1, ...bristol)}
          format={(v) => String(v)}
        />
      </Card>

      <Card title="Sport" takeaway={sportText} foot="Media della giornata, da 0 (bene) a 4 (malissimo).">
        <ColumnChart
          label="Sintomi con e senza attività sportiva"
          items={levelItems(
            ['No', 'Mattina', 'Pom.', 'Sera'],
            sport,
            'giornate',
            ['Senza sport', 'Sport la mattina', 'Sport il pomeriggio', 'Sport la sera'],
          )}
          max={4}
          format={num}
        />
      </Card>

      <Card
        title="Alcol"
        takeaway={drinksText}
        foot="Sintomi nelle 24 ore dopo, da 0 (bene) a 4 (malissimo). Le giornate senza alcolici segnati contano come 0 bicchieri."
      >
        <ColumnChart
          label="Sintomi per numero di bicchieri di alcol"
          caption={['nessuno', '5 o più']}
          items={levelItems(
            ['0', '1', '2', '3', '4', '5+'],
            drinks,
            'giornate',
            ['Nessun bicchiere', '1 bicchiere', '2 bicchieri', '3 bicchieri', '4 bicchieri', '5 o più bicchieri'],
          )}
          max={4}
          format={num}
        />
      </Card>

      <Card
        title="Stress e sonno"
        takeaway={
          st.low !== undefined && st.high !== undefined && st.high - st.low >= NOTABLE
            ? `Con stress alto i sintomi sono in media ${num(st.high)}, con stress basso ${num(st.low)}.`
            : sl.low !== undefined && sl.high !== undefined && sl.low - sl.high >= NOTABLE
              ? `Quando dormi male i sintomi sono in media ${num(sl.low)}, quando dormi bene ${num(sl.high)}.`
              : 'Per ora stress e sonno non sembrano cambiare molto i sintomi.'
        }
        foot="Media della giornata per ogni livello, da 0 (bene) a 4 (malissimo)."
      >
        <div className="twin">
          <div>
            <h3>Stress</h3>
            <ColumnChart
              label="Sintomi per livello di stress"
              caption={['calmo', 'stressato']}
              items={levelItems(['1', '2', '3', '4', '5'], stress, 'giornate', ['Stress 1 (calmo)', 'Stress 2', 'Stress 3', 'Stress 4', 'Stress 5 (stressato)'])}
              max={4}
              format={num}
            />
          </div>
          <div>
            <h3>Sonno</h3>
            <ColumnChart
              label="Sintomi per qualità del sonno"
              caption={['pessimo', 'ottimo']}
              items={levelItems(['1', '2', '3', '4', '5'], sleep, 'giornate', ['Sonno 1 (pessimo)', 'Sonno 2', 'Sonno 3', 'Sonno 4', 'Sonno 5 (ottimo)'])}
              max={4}
              format={num}
            />
          </div>
        </div>
      </Card>

      <p className="saved">Periodo: {range.days ? `dal ${addDays(today, -(range.days - 1)).split('-').reverse().join('/')} a oggi` : 'tutto il diario'}</p>
    </>
  );
}
