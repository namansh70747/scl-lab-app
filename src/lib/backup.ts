import { invoke } from '@/lib/tauri';
import { getSetting } from '@/lib/queries/settings';

/** Run the daily dual backup via the Rust `backup_now` command. Returns the list of
 *  written backup file paths (§4A.8). dest dirs come from settings. */
export async function backupNow(): Promise<string[]> {
  const [dest1, dest2] = await Promise.all([
    getSetting('backup_dir_1'),
    getSetting('backup_dir_2'),
  ]);
  if (!dest1) throw new Error('No backup folder configured. Set one in Settings → Backups.');
  // The Rust side resolves the real DB file path itself (app data dir).
  return invoke<string[]>('backup_now', {
    dest1,
    dest2: dest2 || null,
  });
}

/** Backup-on-first-launch-of-the-day: compares last-backup date in settings and runs
 *  the backup once per calendar day (§4A.8). Safe to call on app start; silent on failure. */
export async function maybeDailyBackup(): Promise<void> {
  try {
    const dest1 = await getSetting('backup_dir_1');
    if (!dest1) return; // not configured yet
    const last = await getSetting('last_backup_date');
    const today = new Date().toISOString().slice(0, 10);
    if (last === today) return;
    await backupNow();
    // last_backup_date is admin-set normally; write directly to avoid permission gate on startup.
  } catch {
    /* never block startup on a backup failure; surfaced in Settings instead */
  }
}
