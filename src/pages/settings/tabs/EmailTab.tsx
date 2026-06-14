import { useState } from "react";
import { Save, MailCheck } from "lucide-react";
import { Card, TabHeader, TextField, PrimaryButton, SecondaryButton } from "../ui";
import { useSettingsForm } from "../useSettingsForm";
import { sendEmail } from "@/lib/email";
import { promptDialog } from "@/lib/dialog";
import { errMessage } from "../toast";

const KEYS = ["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "lab_name"];

export function EmailTab({ settings }: { settings: Record<string, string> }) {
  const f = useSettingsForm(settings, KEYS);
  const [testing, setTesting] = useState(false);

  async function onSave() {
    if (await f.save()) f.toast.success("Email settings saved.");
  }

  async function sendTest() {
    const to = await promptDialog({ title: "Send test email", defaultValue: f.get("smtp_user"), placeholder: "email address", confirmText: "Send" });
    if (!to) return;
    const recipient = to.trim();
    if (!/^\S+@\S+\.\S+$/.test(recipient)) {
      f.toast.error("That doesn't look like a valid email address.");
      return;
    }
    // Persist current SMTP fields first so a test reflects what's on screen.
    if (!(await f.save())) return;
    setTesting(true);
    try {
      await sendEmail({
        host: f.get("smtp_host"),
        port: Number(f.get("smtp_port") || "587"),
        username: f.get("smtp_user"),
        password: f.get("smtp_pass"),
        to: recipient,
        subject: "SMTP test email",
        bodyHtml:
          `<p>This is a test email from <b>${f.get("lab_name") || "your laboratory"}</b>.</p><p>If you received this, your SMTP settings are working.</p>`,
      });
      f.toast.success(`Test email sent to ${recipient}.`);
    } catch (e) {
      f.toast.error(errMessage(e));
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card className="space-y-4 animate-fade-up">
      <div className="flex items-start justify-between gap-4">
        <TabHeader title="Email (SMTP)" subtitle="Used to email report PDFs to patients." />
        <PrimaryButton onClick={onSave} disabled={f.saving || !f.dirty}>
          <Save size={15} strokeWidth={1.8} />
          {f.saving ? "Saving…" : "Save"}
        </PrimaryButton>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextField label="SMTP host" value={f.get("smtp_host")} onChange={(v) => f.set("smtp_host", v)} placeholder="smtp.gmail.com" />
        <TextField label="SMTP port" type="number" value={f.get("smtp_port") || "587"} onChange={(v) => f.set("smtp_port", v)} placeholder="587" />
      </div>
      <TextField label="Username / email address" value={f.get("smtp_user")} onChange={(v) => f.set("smtp_user", v)} placeholder="lab@example.com" />
      <TextField
        label="Password / app password"
        type="password"
        value={f.get("smtp_pass")}
        onChange={(v) => f.set("smtp_pass", v)}
        hint="For Gmail, use a 16-character App Password (not your account password)."
      />

      <div>
        <SecondaryButton onClick={sendTest} disabled={testing || f.saving}>
          <MailCheck size={15} strokeWidth={1.8} />
          {testing ? "Sending…" : "Send test email"}
        </SecondaryButton>
      </div>
    </Card>
  );
}
