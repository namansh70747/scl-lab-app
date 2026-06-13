import { useState } from "react";
import { Save, Send } from "lucide-react";
import { Card, TabHeader, TextField, SelectField, PrimaryButton, SecondaryButton, NoteBox } from "../ui";
import { useSettingsForm } from "../useSettingsForm";
import { sendSms } from "@/lib/sms";
import { promptDialog } from "@/lib/dialog";
import { errMessage } from "../toast";

const KEYS = ["sms_provider", "sms_api_key", "sms_sender_id", "sms_dlt_template_id"];

export function SmsTab({ settings }: { settings: Record<string, string> }) {
  const f = useSettingsForm(settings, KEYS);
  const [testing, setTesting] = useState(false);

  async function onSave() {
    if (await f.save()) f.toast.success("SMS settings saved.");
  }

  async function sendTest() {
    const num = await promptDialog({ title: "Send test SMS", placeholder: "10-digit mobile number", confirmText: "Send" });
    if (!num) return;
    if (!(await f.save())) return;
    setTesting(true);
    try {
      await sendSms({
        provider: f.get("sms_provider") || "fast2sms",
        apiKey: f.get("sms_api_key"),
        senderId: f.get("sms_sender_id"),
        dltTemplateId: f.get("sms_dlt_template_id"),
        phone: num.trim(),
        message: `Test SMS from ${f.get("lab_name") || "your laboratory"}.`,
        vars: ["Test Patient", "0000"],
      });
      f.toast.success(`Test SMS sent to ${num.trim()}.`);
    } catch (e) {
      f.toast.error(errMessage(e));
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card className="space-y-4 animate-fade-up">
      <div className="flex items-start justify-between gap-4">
        <TabHeader title="SMS gateway" subtitle="Send a 'report ready' text to patients via an Indian DLT gateway." />
        <PrimaryButton onClick={onSave} disabled={f.saving || !f.dirty}>
          <Save size={15} strokeWidth={1.8} />
          {f.saving ? "Saving…" : "Save"}
        </PrimaryButton>
      </div>

      <NoteBox tone="warn">
        Indian law (TRAI / DLT) requires automated SMS to use a registered <b>Sender ID</b> (e.g. <b>SCLLAB</b>)
        and a pre-approved <b>template</b> — it cannot show a personal mobile number as the sender. See the setup
        steps in the onboarding guide before filling these in.
      </NoteBox>

      <SelectField
        label="Provider"
        value={f.get("sms_provider") || "fast2sms"}
        onChange={(v) => f.set("sms_provider", v)}
        options={[
          { value: "fast2sms", label: "Fast2SMS" },
          { value: "msg91", label: "MSG91" },
        ]}
      />
      <TextField
        label="API key"
        type="password"
        value={f.get("sms_api_key")}
        onChange={(v) => f.set("sms_api_key", v)}
        hint="From your gateway dashboard (Fast2SMS: Dev API key · MSG91: Auth key)."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextField
          label="Sender ID"
          value={f.get("sms_sender_id")}
          onChange={(v) => f.set("sms_sender_id", v)}
          placeholder="SCLLAB"
          hint="The 6-character DLT-approved header."
        />
        <TextField
          label="DLT template id"
          value={f.get("sms_dlt_template_id")}
          onChange={(v) => f.set("sms_dlt_template_id", v)}
          placeholder="1707xxxxxxxxxxxxx"
          hint="The approved template's message id."
        />
      </div>

      <NoteBox>
        The template you register must have two variables in this order: <b>1) patient name</b>, <b>2) test number</b>.
        Example: <i>“Dear &#123;#var#&#125;, your lab report (Test No &#123;#var#&#125;) from SHARMA CLINICAL
        LABORATORY, Nangal Bhur is ready. Thank you.”</i>
      </NoteBox>

      <div>
        <SecondaryButton onClick={sendTest} disabled={testing || f.saving}>
          <Send size={15} strokeWidth={1.8} />
          {testing ? "Sending…" : "Send test SMS"}
        </SecondaryButton>
      </div>
    </Card>
  );
}
