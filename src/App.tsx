import { useState } from 'react';
import { DayView } from './components/DayView';
import { DiaryView } from './components/DiaryView';
import { InsightsView } from './components/InsightsView';
import { SettingsView } from './components/SettingsView';
import { todayISO } from './date';
import { Icon, type IconName } from './ui';

type Tab = 'oggi' | 'diario' | 'analisi' | 'impostazioni';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'oggi', label: 'Oggi', icon: 'today' },
  { id: 'diario', label: 'Diario', icon: 'diary' },
  { id: 'analisi', label: 'Analisi', icon: 'insights' },
  { id: 'impostazioni', label: 'Impostazioni', icon: 'settings' },
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
        {TABS.map((t) => (
          <button key={t.id} aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
            <Icon name={t.icon} size={22} />
            {t.label}
          </button>
        ))}
      </nav>
    </>
  );
}
