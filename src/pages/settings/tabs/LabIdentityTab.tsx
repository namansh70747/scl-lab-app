import { Save } from "lucide-react";
import { Card, TabHeader, TextField, PrimaryButton } from "../ui";
import { useSettingsForm } from "../useSettingsForm";

const KEYS = [
  "lab_name",
  "address_line",
  "phones",
  "timings",
  "technician_name",
  "technician_qual",
  "equipment_line",
  "footer_tests_line",
];

export function LabIdentityTab({ settings }: { settings: Record<string, string> }) {
  const f = useSettingsForm(settings, KEYS);

  async function onSave() {
    if (await f.save()) f.toast.success("Lab identity saved.");
  }

  return (
    <div className="space-y-4 animate-fade-up">
      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <TabHeader title="Lab Identity" subtitle="Header and footer text printed on every report." />
          <PrimaryButton onClick={onSave} disabled={f.saving || !f.dirty}>
            <Save size={15} strokeWidth={1.8} />
            {f.saving ? "Saving…" : "Save"}
          </PrimaryButton>
        </div>

        <TextField label="Lab Name" value={f.get("lab_name")} onChange={(v) => f.set("lab_name", v)} placeholder="SHARMA CLINICAL LABORATORY" />
        <TextField
          label="Address"
          value={f.get("address_line")}
          onChange={(v) => f.set("address_line", v)}
          placeholder="G.T. ROAD, VILLAGE NANGAL BHUR, TEH. & DISTT. PATHANKOT"
          multiline
          rows={2}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField label="Phone Numbers" value={f.get("phones")} onChange={(v) => f.set("phones", v)} placeholder="9646778583, 9464148746" />
          <TextField label="Timings" value={f.get("timings")} onChange={(v) => f.set("timings", v)} placeholder="Summer 7:30am–9:00pm" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField label="Technician Name" value={f.get("technician_name")} onChange={(v) => f.set("technician_name", v)} placeholder="Rajesh Kumar (Vicky)" />
          <TextField label="Qualification" value={f.get("technician_qual")} onChange={(v) => f.set("technician_qual", v)} placeholder="DMLT (PTU)" />
        </div>
        <TextField
          label="Equipment Line"
          value={f.get("equipment_line")}
          onChange={(v) => f.set("equipment_line", v)}
          placeholder="Equipped With ERBA H360 Blood Cell Counter…"
          multiline
        />
        <TextField
          label="Footer Tests Line"
          value={f.get("footer_tests_line")}
          onChange={(v) => f.set("footer_tests_line", v)}
          placeholder="T3, T4, TSH (THYROID)… TESTS AVAILABLES"
          multiline
        />
      </Card>

      <Card>
        <TabHeader title="Live preview" subtitle="Approximate report header using the values above." />
        <HeaderPreview
          labName={f.get("lab_name") || "SHARMA CLINICAL LABORATORY"}
          address={f.get("address_line")}
          phones={f.get("phones")}
          timings={f.get("timings")}
          tech={f.get("technician_name")}
          qual={f.get("technician_qual")}
          equipment={f.get("equipment_line")}
          footer={f.get("footer_tests_line")}
        />
      </Card>
    </div>
  );
}

function HeaderPreview(props: {
  labName: string;
  address: string;
  phones: string;
  timings: string;
  tech: string;
  qual: string;
  equipment: string;
  footer: string;
}) {
  return (
    <div className="mt-3 border border-[#e6e7ee] rounded-xl overflow-hidden bg-white shadow-[var(--shadow-card)]">
      <div className="px-5 pt-4 pb-3 text-center">
        <div className="flex items-start justify-between gap-3 text-left">
          <div className="w-12 h-12 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-sm shrink-0">SCL</div>
          <div className="flex-1 text-center">
            <div className="text-xl font-extrabold text-[#7b1b1b] leading-tight">{props.labName}</div>
            <div className="inline-block mt-1 border border-[#7b1b1b] text-[#7b1b1b] text-[10px] font-bold px-2 py-0.5 rounded">
              FULLY COMPUTERISED HI-TECH LAB.
            </div>
          </div>
          <div className="text-[10px] text-right text-gray-700 w-32 shrink-0">{props.address || "—"}</div>
        </div>
        <div className="mt-2 flex items-start justify-between gap-2 text-[11px]">
          <div className="text-blue-700 font-bold text-left">{props.phones || "—"}</div>
          <div className="text-gray-700 text-center flex-1">{props.timings || "—"}</div>
          <div className="text-right italic text-gray-800">
            <div className="font-semibold">{props.tech || "—"}</div>
            <div className="not-italic text-[10px]">{props.qual}</div>
          </div>
        </div>
      </div>
      {props.equipment && (
        <div className="border-y-2 border-[#7b1b1b] px-4 py-1.5 text-center text-[10px] font-bold text-[#541212]">
          {props.equipment}
        </div>
      )}
      {props.footer && (
        <div className="px-4 py-1.5 text-center text-[9px] text-gray-600 border-t border-[#e6e7ee]">{props.footer}</div>
      )}
    </div>
  );
}
