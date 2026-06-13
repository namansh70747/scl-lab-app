import { useState } from "react";
import { Save, Send } from "lucide-react";
import { Card, TabHeader, TextField, SelectField, PrimaryButton, SecondaryButton, NoteBox } from "../ui";
import { useSettingsForm } from "../useSettingsForm";
import { sendWhatsAppSemi } from "@/lib/whatsapp";
import { promptDialog } from "@/lib/dialog";
import { errMessage } from "../toast";

const KEYS = ["whatsapp_mode", "bsp_api_key", "wa_phone_id", "bsp_template_name"];

export function WhatsAppTab({ settings }: { settings: Record<string, string> }) {
  const f = useSettingsForm(settings, KEYS);
  const [sending, setSending] = useState(false);
  const mode = f.get("whatsapp_mode") || "semi";

  async function onSave() {
    if (await f.save()) f.toast.success("WhatsApp settings saved.");
  }

  async function sendTest() {
    const input = await promptDialog({ title: "Send test WhatsApp", placeholder: "10-digit number", confirmText: "Open" });
    if (!input) return;
    const phone = input.replace(/\D/g, "");
    if (phone.length !== 10) {
      f.toast.error("Please enter a 10-digit mobile number.");
      return;
    }
    setSending(true);
    try {
      await sendWhatsAppSemi(
        phone,
        "Test message from Sharma Clinical Laboratory. If you can read this, WhatsApp delivery is working."
      );
      f.toast.success(`Opened WhatsApp for ${phone}.`);
    } catch (e) {
      f.toast.error(errMessage(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="space-y-4 animate-fade-up">
      <div className="flex items-start justify-between gap-4">
        <TabHeader title="WhatsApp" subtitle="How report PDFs are sent to patients' WhatsApp." />
        <PrimaryButton onClick={onSave} disabled={f.saving || !f.dirty}>
          <Save size={15} strokeWidth={1.8} />
          {f.saving ? "Saving…" : "Save"}
        </PrimaryButton>
      </div>

      <SelectField
        label="Delivery mode"
        value={mode}
        onChange={(v) => f.set("whatsapp_mode", v)}
        options={[
          { value: "semi", label: "Semi-automatic (opens WhatsApp, one click)" },
          { value: "api", label: "Automatic via WhatsApp Business API" },
        ]}
        hint={
          mode === "api"
            ? "Requires completed BSP onboarding (Meta verification + approved utility template)."
            : "Zero cost, zero ban risk — opens wa.me prefilled and reveals the PDF to drag in."
        }
      />

      {mode === "api" && (
        <>
          <NoteBox tone="warn">
            Automatic sending uses the <b>WhatsApp Business Cloud API</b> and needs a
            <b> dedicated phone number</b> (not the lab's personal WhatsApp), a free Meta Business
            account, and a permanent access token. Get the <b>Access token</b> and <b>Phone number ID</b>
            from Meta → WhatsApp → API Setup. See the onboarding guide for the full steps.
          </NoteBox>
          <TextField
            label="Access token"
            type="password"
            value={f.get("bsp_api_key")}
            onChange={(v) => f.set("bsp_api_key", v)}
            placeholder="Permanent token from Meta (System User)"
          />
          <TextField
            label="Phone number ID"
            value={f.get("wa_phone_id")}
            onChange={(v) => f.set("wa_phone_id", v)}
            placeholder="e.g. 1029384756xxxxx"
            hint="From Meta → WhatsApp → API Setup (not the phone number itself)."
          />
          <TextField
            label="Template name (for first contact)"
            value={f.get("bsp_template_name")}
            onChange={(v) => f.set("bsp_template_name", v)}
            placeholder="report_ready"
            hint="Optional. Needed only to message patients who haven't messaged the lab in 24h."
          />
        </>
      )}

      <div>
        <SecondaryButton onClick={sendTest} disabled={sending}>
          <Send size={15} strokeWidth={1.8} />
          {sending ? "Opening…" : "Send test message"}
        </SecondaryButton>
      </div>
    </Card>
  );
}
