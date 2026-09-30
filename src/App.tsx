import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { DayView } from './components/DayView';
import { DiaryView } from './components/DiaryView';
import { InsightsView } from './components/InsightsView';
import { SettingsView } from './components/SettingsView';
import { Welcome } from './components/Welcome';
import { db, replaceDays } from './db';
import { generateDemo } from './demo';
import { todayISO } from './date';
import { Icon, type IconName } from './ui';

type Tab = 'oggi' | 'diario' | 'analisi' | 'impostazioni';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'oggi', label: 'Oggi', icon: 'today' },
  { id: 'diario', label: 'Diario', icon: 'diary' },
  { id: 'analisi', label: 'Analisi', icon: 'insights' },
  { id: 'impostazioni', label: 'Impostazioni', icon: 'settings' },
];

const WELCOME_KEY = 'gutty:welcomed';

function readWelcomed(): boolean {
  try {
    return localStorage.getItem(WELCOME_KEY) === '1';
  } catch {
    return false;
  }
}

export function App() {
  const [tab, setTab] = useState<Tab>('oggi');
  const [date, setDate] = useState(todayISO());
  const [welcomed, setWelcomed] = useState(readWelcomed);
  const dayCount = useLiveQuery(() => db.days.count(), []);

  const go = (t: Tab) => {
    setTab(t);
    window.scrollTo({ top: 0 });
  };

  const finishWelcome = (next: Tab) => {
    try {
      localStorage.setItem(WELCOME_KEY, '1');
    } catch {
      // Senza storage il benvenuto ricomparirà: nessun danno.
    }
    setWelcomed(true);
    go(next);
  };

  if (dayCount === undefined) return null;
  // Il benvenuto compare solo al primo avvio, e mai se ci sono già dati.
  if (!welcomed && dayCount === 0) {
    return (
      <Welcome
        onStart={() => finishWelcome('oggi')}
        onRestore={() => finishWelcome('impostazioni')}
        onDemo={() => void replaceDays(generateDemo()).then(() => finishWelcome('analisi'))}
      />
    );
  }

  return (
    <>
      <main className="app">
        {tab === 'oggi' && <DayView date={date} onDateChange={setDate} />}
        {tab === 'diario' && (
          <DiaryView
            onOpen={(d) => {
              setDate(d);
              go('oggi');
            }}
          />
        )}
        {tab === 'analisi' && <InsightsView />}
        {tab === 'impostazioni' && <SettingsView />}
      </main>
      <nav className="tabbar" aria-label="Sezioni">
        <div className="tabbar-inner">
          {TABS.map((t) => (
            <button key={t.id} aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
              <span className="ic">
                <Icon name={t.icon} size={22} />
              </span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
