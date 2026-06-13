import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Save, DatabaseBackup, RotateCcw, FolderOpen } from "lucide-react";
import { Card, TabHeader, TextField, PrimaryButton, SecondaryButton, NoteBox } from "../ui";
import { useSettingsForm } from "../useSettingsForm";
import { backupNow } from "@/lib/backup";
import { errMessage } from "../toast";

const KEYS = ["backup_dir_1", "backup_dir_2", "backup_retention_days"];

export function BackupsTab({ settings }: { settings: Record<string, string> }) {
  const f = useSettingsForm(settings, KEYS);
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [lastPaths, setLastPaths] = useState<string[] | null>(null);

  const lastBackupDate = settings.last_backup_date || "Never";

  async function onSave() {
    if (await f.save()) f.toast.success("Backup settings saved.");
  }

  async function runBackup() {
    // Make sure the folder fields are persisted first — backupNow() reads them from settings.
    const ok = await f.save();
    if (!ok) return;
    setRunning(true);
    setLastPaths(null);
    try {
      const paths = await backupNow();
      setLastPaths(paths);
      await qc.invalidateQueries({ queryKey: ['settings'] });   // refresh the "Last backup" date
      f.toast.success(`Backup complete — ${paths.length} file(s) written.`);
    } catch (e) {
      f.toast.error(errMessage(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4 animate-fade-up">
      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <TabHeader title="Backups" subtitle="Two destinations are written every day (e.g. local/USB + Google Drive folder)." />
          <PrimaryButton onClick={onSave} disabled={f.saving || !f.dirty}>
            <Save size={15} strokeWidth={1.8} />
            {f.saving ? "Saving…" : "Save"}
          </PrimaryButton>
        </div>

        <TextField
          label="Backup folder 1 (local / USB)"
          value={f.get("backup_dir_1")}
          onChange={(v) => f.set("backup_dir_1", v)}
          placeholder="C:\\Backups\\SCL"
        />
        <TextField
          label="Backup folder 2 (Google Drive / network)"
          value={f.get("backup_dir_2")}
          onChange={(v) => f.set("backup_dir_2", v)}
          placeholder="Path to a Drive-synced folder (optional)"
        />
        <TextField
          label="Retention (days)"
          type="number"
          value={f.get("backup_retention_days") || "30"}
          onChange={(v) => f.set("backup_retention_days", v)}
          hint="Backups older than this many days are pruned."
        />

        <div className="flex items-center gap-3 flex-wrap pt-1">
          <PrimaryButton onClick={runBackup} disabled={running || f.saving}>
            <DatabaseBackup size={15} strokeWidth={1.8} />
            {running ? "Backing up…" : "Backup now"}
          </PrimaryButton>
          <span className="text-[12px] text-[#a3a5b3]">
            Last backup: <b className="font-semibold text-[#54555f]">{lastBackupDate}</b>
          </span>
        </div>

        {lastPaths && lastPaths.length > 0 && (
          <NoteBox tone="success">
            <div className="font-semibold mb-1">Wrote {lastPaths.length} file(s):</div>
            <ul className="space-y-0.5 font-mono break-all">
              {lastPaths.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </NoteBox>
        )}
      </Card>

      <RestoreWizard onToast={(m) => f.toast.error(m)} onInfo={(m) => f.toast.success(m)} />
    </div>
  );
}

function RestoreWizard({ onInfo }: { onToast: (m: string) => void; onInfo: (m: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  function confirmRestore() {
    // There is no restore_backup Rust command yet — degrade gracefully (no crash).
    onInfo("Restore will be available in the packaged desktop app. Your chosen backup was noted but not applied.");
    setChosen(null);
  }

  return (
    <Card className="space-y-4">
      <TabHeader title="Restore from backup" subtitle="Replace the current database with a previous backup." />

      <NoteBox tone="warn">
        Restore overwrites all current data. It runs only in the packaged desktop app, where the database can be safely
        swapped and the app restarted.
      </NoteBox>

      <input
        ref={inputRef}
        type="file"
        accept=".db,.sqlite,.sqlite3,.bak"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setChosen(file.name);
          e.target.value = "";
        }}
      />

      <div className="flex items-center gap-3 flex-wrap">
        <SecondaryButton onClick={() => inputRef.current?.click()}>
          <FolderOpen size={15} strokeWidth={1.8} />
          Choose backup file…
        </SecondaryButton>
        {chosen && <span className="text-[12px] text-[#54555f] font-mono">{chosen}</span>}
      </div>

      {chosen && (
        <PrimaryButton onClick={confirmRestore}>
          <RotateCcw size={15} strokeWidth={1.8} />
          Restore from “{chosen}”
        </PrimaryButton>
      )}
    </Card>
  );
}
