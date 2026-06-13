import { useState } from "react";
import { Save, Printer } from "lucide-react";
import { Card, TabHeader, TextField, PrimaryButton, SecondaryButton, NoteBox } from "../ui";
import { useSettingsForm } from "../useSettingsForm";
import { openPrintTestPage } from "@/lib/pdf";
import { errMessage } from "../toast";

const KEYS = ["printer_name"];

export function PrintingTab({ settings }: { settings: Record<string, string> }) {
  const f = useSettingsForm(settings, KEYS);
  const [printing, setPrinting] = useState(false);

  async function onSave() {
    if (await f.save()) f.toast.success("Printing settings saved.");
  }

  async function printTestPage() {
    setPrinting(true);
    try {
      await openPrintTestPage(f.get("printer_name"));
      f.toast.success("Test page opened — press Ctrl/⌘+P in the viewer to print.");
    } catch (e) {
      f.toast.error(errMessage(e));
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Card className="space-y-4 animate-fade-up">
      <div className="flex items-start justify-between gap-4">
        <TabHeader title="Printing" subtitle="Choose the report printer and verify alignment." />
        <PrimaryButton onClick={onSave} disabled={f.saving || !f.dirty}>
          <Save size={15} strokeWidth={1.8} />
          {f.saving ? "Saving…" : "Save"}
        </PrimaryButton>
      </div>

      <TextField
        label="Printer name"
        value={f.get("printer_name")}
        onChange={(v) => f.set("printer_name", v)}
        placeholder="e.g. HP LaserJet (leave blank for system default)"
        hint="Leave blank to use the operating system's default printer. The browser/OS print dialog still lets you pick at print time."
      />

      <div>
        <SecondaryButton onClick={printTestPage} disabled={printing}>
          <Printer size={15} strokeWidth={1.8} />
          {printing ? "Opening…" : "Print test page"}
        </SecondaryButton>
      </div>

      <NoteBox tone="warn">
        <b>Margins:</b> reports use A4 portrait with ~12&nbsp;mm margins. Use your printer's properties dialog (not page scaling) to
        adjust if the header clips — set scaling to 100% / “Actual size” and disable “fit to page”.
      </NoteBox>
    </Card>
  );
}
