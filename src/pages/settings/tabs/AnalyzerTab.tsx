import { useState } from "react";
import { Save, RefreshCw, Cable } from "lucide-react";
import { Card, TabHeader, TextField, SelectField, PrimaryButton, SecondaryButton, NoteBox } from "../ui";
import { useSettingsForm } from "../useSettingsForm";
import { listSerialPorts, readSerialRaw } from "@/lib/serial";
import { parseAnalyzer } from "@/lib/astm";
import { errMessage } from "../toast";

const KEYS = ["analyzer_port", "analyzer_baud"];
const BAUDS = ["1200", "2400", "4800", "9600", "19200", "38400", "57600", "115200"];

export function AnalyzerTab({ settings }: { settings: Record<string, string> }) {
  const f = useSettingsForm(settings, KEYS);
  const [ports, setPorts] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [raw, setRaw] = useState<string>("");

  async function refreshPorts() {
    try {
      setPorts(await listSerialPorts());
    } catch (e) {
      f.toast.error(errMessage(e));
    }
  }

  async function capture() {
    if (!(await f.save())) return;
    setBusy(true);
    setRaw("");
    try {
      const text = await readSerialRaw(f.get("analyzer_port"), Number(f.get("analyzer_baud") || "9600"), 8000);
      setRaw(text);
      const parsed = parseAnalyzer(text);
      const n = Object.keys(parsed.values).length;
      f.toast.success(n ? `Read ${n} parameters from the analyzer.` : "Data received, but no parameters were recognised — see raw output below.");
    } catch (e) {
      f.toast.error(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const portOptions = [
    { value: "", label: "— select port —" },
    ...ports.map((p) => ({ value: p, label: p })),
    ...(f.get("analyzer_port") && !ports.includes(f.get("analyzer_port"))
      ? [{ value: f.get("analyzer_port"), label: `${f.get("analyzer_port")} (saved)` }]
      : []),
  ];

  return (
    <Card className="space-y-4 animate-fade-up">
      <div className="flex items-start justify-between gap-4">
        <TabHeader title="CBC analyzer" subtitle="Read CBC results from the ERBA H360 over its serial cable." />
        <PrimaryButton onClick={async () => { if (await f.save()) f.toast.success("Analyzer settings saved."); }} disabled={f.saving || !f.dirty}>
          <Save size={15} strokeWidth={1.8} />
          {f.saving ? "Saving…" : "Save"}
        </PrimaryButton>
      </div>

      <NoteBox>
        Connect the H360 to this PC's serial (COM) port, set the same baud rate as the machine's LIS/Host
        setting, then run a sample. On the Result Entry screen press <b>Read from analyzer</b> and confirm the
        values before they fill the report.
      </NoteBox>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
        <SelectField label="Serial port" value={f.get("analyzer_port")} onChange={(v) => f.set("analyzer_port", v)} options={portOptions} />
        <SecondaryButton onClick={refreshPorts}>
          <RefreshCw size={14} strokeWidth={1.8} /> List ports
        </SecondaryButton>
      </div>

      <SelectField
        label="Baud rate"
        value={f.get("analyzer_baud") || "9600"}
        onChange={(v) => f.set("analyzer_baud", v)}
        options={BAUDS.map((b) => ({ value: b, label: b }))}
        hint="Must match the rate configured on the analyzer (commonly 9600)."
      />

      <div>
        <SecondaryButton onClick={capture} disabled={busy || !f.get("analyzer_port")}>
          <Cable size={15} strokeWidth={1.8} />
          {busy ? "Listening…" : "Capture raw (test)"}
        </SecondaryButton>
      </div>

      {raw && (
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a857d] mb-1.5">Raw output</div>
          <pre className="max-h-56 overflow-auto rounded-lg bg-[#1d1b18] text-[#e8e6e1] text-[11px] leading-relaxed p-3 whitespace-pre-wrap break-all">{raw}</pre>
        </div>
      )}
    </Card>
  );
}
