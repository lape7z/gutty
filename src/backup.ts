import { exportBackup, restoreBackup, type Backup } from './db';
import { todayISO } from './date';

// Protezioni per i dati. Il diario vive solo nel browser del telefono: questi aiuti servono a
// tenerne una copia fuori dall'app e a poter annullare le operazioni che lo sostituiscono.

const LAST_BACKUP_KEY = 'gutty:lastBackup';
const SNOOZE_KEY = 'gutty:backupSnooze';
const SNAPSHOT_KEY = 'gutty:snapshot';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage non disponibile: la protezione è solo più debole, l'app funziona lo stesso.
  }
}

export function lastBackupAt(): Date | null {
  const v = read(LAST_BACKUP_KEY);
  return v ? new Date(Number(v)) : null;
}

/** Il promemoria compare se ci sono dati e l'ultimo backup ha più di `days` giorni (o non c'è mai stato). */
export function backupDue(dayCount: number, days = 7, now = Date.now()): boolean {
  if (dayCount < 3) return false;
  const snooze = Number(read(SNOOZE_KEY) ?? 0);
  if (snooze > now) return false;
  const last = lastBackupAt();
  return !last || now - last.getTime() > days * 86_400_000;
}

export function snoozeBackup(days = 3): void {
  write(SNOOZE_KEY, String(Date.now() + days * 86_400_000));
}

export type BackupResult = 'shared' | 'downloaded' | 'copied' | 'cancelled' | 'failed';

/**
 * Salva il backup come file. Sul telefono apre il menu Condividi (iCloud Drive, Google Drive,
 * File, email…); dove non è possibile scarica il file; nell'anteprima lo copia negli appunti.
 */
export async function saveBackup(): Promise<{ result: BackupResult; text?: string }> {
  const backup = await exportBackup();
  const text = JSON.stringify(backup, null, 2);
  const name = `gutty-backup-${todayISO()}.json`;

  if (import.meta.env.VITE_ARTIFACT) {
    try {
      await navigator.clipboard.writeText(text);
      markBackupDone();
      return { result: 'copied' };
    } catch {
      return { result: 'failed', text };
    }
  }

  const file = new File([text], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Backup di Gutty' });
      markBackupDone();
      return { result: 'shared' };
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return { result: 'cancelled' };
      // Condivisione non riuscita: si ripiega sul download.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  markBackupDone();
  return { result: 'downloaded' };
}

function markBackupDone(): void {
  write(LAST_BACKUP_KEY, String(Date.now()));
  write(SNOOZE_KEY, null);
}

/** Copia di sicurezza prima di un'operazione che sostituisce o cancella il diario. */
export async function takeSnapshot(): Promise<void> {
  const backup = await exportBackup();
  if (backup.days.length === 0) return;
  write(SNAPSHOT_KEY, JSON.stringify(backup));
}

export function snapshotInfo(): { days: number; savedAt: string } | null {
  const raw = read(SNAPSHOT_KEY);
  if (!raw) return null;
  try {
    const b = JSON.parse(raw) as Backup;
    return { days: b.days.length, savedAt: b.exportedAt };
  } catch {
    return null;
  }
}

/** Rimette il diario com'era prima dell'ultima sostituzione o cancellazione. */
export async function restoreSnapshot(): Promise<number> {
  const raw = read(SNAPSHOT_KEY);
  if (!raw) return 0;
  const b = JSON.parse(raw) as Backup;
  await restoreBackup(b);
  write(SNAPSHOT_KEY, null);
  return b.days.length;
}
