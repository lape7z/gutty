import { useState, type ReactNode } from 'react';
import { DayView } from './components/DayView';
import { DiaryView } from './components/DiaryView';
import { InsightsView } from './components/InsightsView';
import { SettingsView } from './components/SettingsView';
import { todayISO } from './date';

type Tab = 'oggi' | 'diario' | 'analisi' | 'impostazioni';

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'oggi', label: 'Oggi', icon: icon('M12 5v14M5 12h14') },
  { id: 'diario', label: 'Diario', icon: icon('M4 5h16M4 12h16M4 19h10') },
  { id: 'analisi', label: 'Analisi', icon: icon('M4 20V10M10 20V4M16 20v-7M22 20H2') },
  { id: 'impostazioni', label: 'Impostazioni', icon: icon('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12h2M3 12h2M12 3v2M12 19v2M17 7l1.5-1.5M5.5 18.5 7 17M17 17l1.5 1.5M5.5 5.5 7 7') },
];

export function App() {
  const [tab, setTab] = useState<Tab>('oggi');
  const [date, setDate] = useState(todayISO());

  const go = (t: Tab) => {
    setTab(t);
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <main className="app">
        <header className="app-header">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" />
          <h1>Gutty</h1>
          <span className="muted small">diario del colon irritabile</span>
        </header>
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
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
