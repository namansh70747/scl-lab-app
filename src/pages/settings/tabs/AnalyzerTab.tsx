import { useState, useEffect } from "react";
import { Save, RefreshCw, Cable } from "lucide-react";
import { Card, TabHeader, TextField, SelectField, PrimaryButton, SecondaryButton, NoteBox } from "../ui";
import { useSettingsForm } from "../useSettingsForm";
import { listSerialPorts, readSerialRaw, readTcpRaw, localIps } from "@/lib/serial";
import { parseAnalyzer } from "@/lib/astm";
import { errMessage } from "../toast";

const KEYS = ["analyzer_conn", "analyzer_tcp_mode", "analyzer_host", "analyzer_tcp_port", "analyzer_port", "analyzer_baud"];
const BAUDS = ["1200", "2400", "4800", "9600", "19200", "38400", "57600", "115200"];

export function AnalyzerTab({ settings }: { settings: Record<string, string> }) {
  const f = useSettingsForm(settings, KEYS);
  const [ports, setPorts] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [raw, setRaw] = useState<string>("");
  const [pcIps, setPcIps] = useState<string[]>([]);

  const conn = f.get("analyzer_conn") || "network";
  const tcpMode = f.get("analyzer_tcp_mode") || "listen";

  useEffect(() => { localIps().then(setPcIps).catch(() => {}); }, []);

  async function refreshPorts() {
    try { setPorts(await listSerialPorts()); }
    catch (e) { f.toast.error(errMessage(e)); }
  }

  async function capture() {
    if (!(await f.save())) return;
    setBusy(true);
    setRaw("");
    try {
      const text = conn === "network"
        ? await readTcpRaw(tcpMode, f.get("analyzer_host"), Number(f.get("analyzer_tcp_port") || "5000"), 60000)
        : await readSerialRaw(f.get("analyzer_port"), Number(f.get("analyzer_baud") || "9600"), 20000);
      setRaw(text);
      const n = Object.keys(parseAnalyzer(text).values).length;
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
      ? [{ value: f.get("analyzer_port"), label: `${f.get("analyzer_port")} (saved)` }] : []),
  ];

  return (
    <Card className="space-y-4 animate-fade-up">
      <div className="flex items-start justify-between gap-4">
        <TabHeader title="CBC analyzer" subtitle="Read CBC results from the ERBA H360." />
        <PrimaryButton onClick={async () => { if (await f.save()) f.toast.success("Analyzer settings saved."); }} disabled={f.saving || !f.dirty}>
          <Save size={15} strokeWidth={1.8} />
          {f.saving ? "Saving…" : "Save"}
        </PrimaryButton>
      </div>

      <SelectField
        label="Connection"
        value={conn}
        onChange={(v) => f.set("analyzer_conn", v)}
        options={[
          { value: "network", label: "Network (Ethernet / LAN) — H360 default" },
          { value: "serial", label: "Serial cable (COM port)" },
        ]}
      />

      {conn === "network" ? (
        <>
          <NoteBox>
            The H360 sends results over the network. On the analyzer's <b>Host Communication</b>{" "}
            screen set the <b>Host IP</b> to <b>this PC's IP</b> and <b>Host Port</b> to the port
            below, then keep <b>“PC waits for analyzer”</b> here. Both must be on the same network.
            Run a sample, then click <b>Capture raw</b> to confirm.
          </NoteBox>
          {pcIps.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-[#c7c9ff] bg-[#eef0fe] px-3.5 py-2.5">
              <span className="text-[12.5px] text-[#4338ca]">
                This PC's IP — enter on the H360 as Host IP:
              </span>
              <span className="font-mono font-semibold text-[13px] text-[#312e81] tabular-nums">{pcIps.join(", ")}</span>
            </div>
          )}

          <SelectField
            label="Who connects?"
            value={tcpMode}
            onChange={(v) => f.set("analyzer_tcp_mode", v)}
            options={[
              { value: "listen", label: "PC waits for the analyzer to send (recommended)" },
              { value: "connect", label: "PC connects to the analyzer" },
            ]}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              label={tcpMode === "connect" ? "Analyzer IP address" : "Analyzer IP (for reference)"}
              value={f.get("analyzer_host")}
              onChange={(v) => f.set("analyzer_host", v)}
              placeholder="192.168.1.110"
              hint={tcpMode === "connect" ? "The H360's IP from its network screen." : "Shown on the H360 network screen."}
            />
            <TextField
              label="Port"
              type="number"
              value={f.get("analyzer_tcp_port") || "5000"}
              onChange={(v) => f.set("analyzer_tcp_port", v)}
              placeholder="5000"
              hint="Must match the analyzer's Host Port."
            />
          </div>
        </>
      ) : (
        <>
          <NoteBox>
            Connect the H360 to this PC's serial (COM) port and set the same baud rate as the
            machine's LIS/Host setting. Run a sample, then click <b>Capture raw</b> to confirm.
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
        </>
      )}

      <div>
        <SecondaryButton onClick={capture} disabled={busy}>
          <Cable size={15} strokeWidth={1.8} />
          {busy ? "Listening… (now re-transmit on the H360)" : "Capture raw (test)"}
        </SecondaryButton>
      </div>

      {raw && (
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a8b97] mb-1.5">Raw output</div>
          <pre className="max-h-56 overflow-auto rounded-lg bg-[#14151c] text-[#e8e6e1] text-[11px] leading-relaxed p-3 whitespace-pre-wrap break-all">{raw}</pre>
        </div>
      )}
    </Card>
  );
}
