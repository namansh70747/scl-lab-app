import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { Check, Loader2, ShieldCheck, KeyRound, Sparkles, Building2, ArrowRight } from "lucide-react";
import { NamAstaWordmark } from "@/components/common/NamAstaLogo";
import { activateLicense, type LicenseStatus } from "@/lib/license";
import { completeSetup } from "@/lib/onboarding";
import { useSession } from "@/lib/session";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

// ── Vendor payment details (edit here to rebill) ──
const UPI_ID = "namsh70747@oksbi";
const PAYEE = "Naman Sharma";
const VENDOR_CONTACT = "the NamAsta team";

interface Plan { id: string; label: string; price: number; per: string; note?: string; best?: boolean; }
const PLANS: Plan[] = [
  { id: "monthly", label: "Monthly", price: 500, per: "/ month" },
  { id: "yearly", label: "Yearly", price: 3000, per: "/ year", note: "Save ₹3,000 vs monthly", best: true },
  { id: "triennial", label: "3 Years", price: 8000, per: "/ 3 years", note: "Best value" },
];

const fieldLabel = "block text-[12px] font-medium text-white/60 mb-1.5";

export function OnboardingPage({ licensed, needSetup, status, onDone, preview }: {
  licensed: boolean; needSetup: boolean; status: LicenseStatus; onDone: () => void; preview?: boolean;
}) {
  const [step, setStep] = useState<"activate" | "setup">(licensed && !preview ? "setup" : "activate");
  // After a successful activation: a brand-new lab still needs to set up; a RENEWING lab that's
  // already set up goes straight in (never re-enters its details).
  const afterActivate = () => { if (needSetup) setStep("setup"); else onDone(); };
  const exitPreview = () => { localStorage.removeItem("namasta_dev_onboard"); onDone(); };

  return (
    <div className="relative min-h-screen w-full overflow-y-auto text-white"
         style={{ background: "linear-gradient(150deg, #14161f 0%, #0e0f16 55%, #0a0b10 100%)" }}>
      <div className="pointer-events-none fixed -top-32 -left-24 w-[34rem] h-[34rem] rounded-full bg-[#6366f1]/25 blur-3xl animate-float" />
      <div className="pointer-events-none fixed top-1/3 right-[-10rem] w-[30rem] h-[30rem] rounded-full bg-[#7c3aed]/30 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-40 left-1/3 w-[28rem] h-[28rem] rounded-full bg-[#22d3ee]/12 blur-3xl" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.06]"
           style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "30px 30px" }} />

      <div className="relative mx-auto max-w-5xl px-6 py-9">
        <div className="flex items-center justify-between gap-4">
          <NamAstaWordmark size={42} light />
          <Stepper step={step} showActivate={!licensed} />
        </div>

        {preview && (
          <div className="mt-4 flex items-center gap-2 text-[11px]">
            <span className="text-white/35 uppercase tracking-wider">Dev preview:</span>
            <button onClick={() => setStep("activate")} className={cn("px-2.5 py-1 rounded-full border", step === "activate" ? "border-[#818cf8] text-[#c7cbff]" : "border-white/15 text-white/50")}>Pay & activate</button>
            <button onClick={() => setStep("setup")} className={cn("px-2.5 py-1 rounded-full border", step === "setup" ? "border-[#818cf8] text-[#c7cbff]" : "border-white/15 text-white/50")}>Set up lab</button>
            <button onClick={exitPreview} className="ml-auto px-2.5 py-1 rounded-full border border-white/15 text-white/50 hover:text-white/80">Exit preview →</button>
          </div>
        )}

        {step === "activate"
          ? <ActivateStep status={status} onActivated={afterActivate} />
          : <SetupStep onDone={onDone} />}
      </div>
    </div>
  );
}

function Stepper({ step, showActivate }: { step: string; showActivate: boolean }) {
  if (!showActivate) return null;
  const items = [{ id: "activate", label: "Pay & activate" }, { id: "setup", label: "Set up lab" }];
  return (
    <div className="hidden sm:flex items-center gap-2 text-[12px]">
      {items.map((it, i) => (
        <span key={it.id} className="flex items-center gap-2">
          <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold",
            step === it.id ? "bg-[#6366f1] text-white" : "bg-white/10 text-white/50")}>{i + 1}</span>
          <span className={step === it.id ? "text-white/90" : "text-white/40"}>{it.label}</span>
          {i === 0 && <span className="mx-1 h-px w-6 bg-white/15" />}
        </span>
      ))}
    </div>
  );
}

function ActivateStep({ status, onActivated }: { status: LicenseStatus; onActivated: () => void }) {
  const [plan, setPlan] = useState<Plan>(PLANS[1]);
  const [qr, setQr] = useState("");
  const [key, setKey] = useState("");
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    const upi = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(PAYEE)}&am=${plan.price}&cu=INR&tn=${encodeURIComponent("NamAsta " + plan.label)}`;
    QRCode.toDataURL(upi, { errorCorrectionLevel: "M", margin: 1, width: 240, color: { dark: "#14151c", light: "#ffffff" } })
      .then(setQr).catch(() => setQr(""));
  }, [plan]);

  async function activate() {
    if (!key.trim() || activating) return;
    setActivating(true);
    try {
      const info = await activateLicense(key);
      toast.success(`Activated — valid till ${new Date(info.exp * 1000).toLocaleDateString("en-IN")}.`);
      onActivated();
    } catch (e) { toast.error(e); } finally { setActivating(false); }
  }

  return (
    <div className="mt-7 grid lg:grid-cols-2 gap-6 items-start">
      <div className="rounded-3xl border border-white/10 glass-dark p-7">
        <div className="flex items-center gap-2 text-[#c7cbff] text-[12px] font-semibold uppercase tracking-[0.15em]">
          <Sparkles size={14} /> Activate your laboratory
        </div>
        <h1 className="mt-3 text-[1.9rem] font-extrabold leading-tight">
          The complete lab, <span style={{ background: "linear-gradient(120deg,#818cf8,#c7cbff 50%,#67e8f9)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>fully computerised.</span>
        </h1>
        <p className="mt-3 text-white/55 text-[14px] leading-relaxed">
          Registration, result entry, auto-calculated reports, WhatsApp &amp; email delivery,
          analyzer import, billing and backups — offline and error-proof.
        </p>
        {status.expired && (
          <div className="mt-5 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-200">
            Your {status.plan} licence for <b>{status.lab}</b> has expired. Renew below to continue.
          </div>
        )}
        <div className="mt-6 space-y-2.5">
          {PLANS.map(p => (
            <button key={p.id} onClick={() => setPlan(p)}
              className={cn("relative w-full flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all",
                plan.id === p.id ? "border-[#818cf8] bg-[#6366f1]/15 shadow-[0_8px_30px_-10px_rgba(99,102,241,0.6)]" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]")}>
              <span className="flex items-center gap-3">
                <span className={cn("flex h-5 w-5 items-center justify-center rounded-full border", plan.id === p.id ? "border-[#818cf8] bg-[#6366f1]" : "border-white/25")}>
                  {plan.id === p.id && <Check size={12} strokeWidth={3} />}
                </span>
                <span>
                  <span className="block text-[14px] font-semibold">{p.label}</span>
                  {p.note && <span className="block text-[11.5px] text-white/45">{p.note}</span>}
                </span>
              </span>
              <span className="text-right">
                <span className="text-[18px] font-extrabold tabular-nums">₹{p.price.toLocaleString("en-IN")}</span>
                <span className="block text-[11px] text-white/45">{p.per}</span>
              </span>
              {p.best && <span className="absolute right-3 -top-2 chip chip-blue !text-[10px]">Popular</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 glass-dark p-7">
        <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/50">Step 1 — Pay ₹{plan.price.toLocaleString("en-IN")}</div>
        <div className="mt-4 flex items-center gap-5">
          <div className="rounded-2xl bg-white p-2.5 shrink-0">
            {qr ? <img src={qr} alt="UPI QR" width={132} height={132} /> : <div className="w-[132px] h-[132px] skeleton" />}
          </div>
          <div className="min-w-0 text-[13px] text-white/70 leading-relaxed">
            <p>Scan with any UPI app (GPay, PhonePe, Paytm).</p>
            <p className="mt-1.5 text-white/45">Paying</p>
            <p className="font-semibold text-white">{PAYEE}</p>
            <p className="font-mono text-[12.5px] text-[#c7cbff] break-all">{UPI_ID}</p>
          </div>
        </div>
        <div className="mt-6 text-[12px] font-semibold uppercase tracking-[0.12em] text-white/50">Step 2 — Enter your key</div>
        <p className="mt-2 text-[13px] text-white/55 leading-relaxed">
          After paying, send the screenshot to {VENDOR_CONTACT}. You'll receive an
          <b className="text-white/80"> activation key</b> — paste it below.
        </p>
        <div className="mt-3 relative">
          <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
          <input value={key} onChange={e => setKey(e.target.value)} onKeyDown={e => { if (e.key === "Enter") activate(); }}
            placeholder="Paste activation key" spellCheck={false} className="login-input !pl-9 font-mono text-[12.5px]" />
        </div>
        <button onClick={activate} disabled={activating || !key.trim()} className="login-btn mt-3">
          {activating ? <Loader2 size={18} className="animate-spin" /> : <>Activate <ArrowRight size={17} /></>}
        </button>
        <p className="mt-3 text-center text-[11px] text-white/35">Stored on this PC · works fully offline</p>
      </div>
    </div>
  );
}

function SetupStep({ onDone }: { onDone: () => void }) {
  const setUser = useSession(s => s.setUser);
  const navigate = useNavigate();
  const [f, setF] = useState({ labName: "", address: "", phones: "", timings: "", incharge: "", qual: "", username: "", pw: "", pw2: "" });
  const set = (k: keyof typeof f) => (v: string) => setF(p => ({ ...p, [k]: v }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function finish() {
    setErr("");
    if (!f.labName.trim()) return setErr("Enter your laboratory's name.");
    if (!f.incharge.trim()) return setErr("Enter the lab in-charge / signatory name (it appears on reports).");
    if (f.username.trim().length < 3) return setErr("Choose a username of at least 3 characters.");
    if (/\s/.test(f.username.trim())) return setErr("Username can't contain spaces.");
    if (f.pw.length < 4) return setErr("Password must be at least 4 characters.");
    if (f.pw !== f.pw2) return setErr("Passwords do not match.");
    setBusy(true);
    try {
      const user = await completeSetup({
        labName: f.labName, address: f.address, phones: f.phones, timings: f.timings,
        inchargeName: f.incharge, inchargeQual: f.qual, username: f.username, password: f.pw,
      });
      setUser(user);
      toast.success(`Welcome, ${f.labName.trim()}!`);
      onDone();
      navigate("/dashboard");
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setBusy(false); }
  }

  return (
    <div className="mt-7 mx-auto max-w-2xl rounded-3xl border border-white/10 glass-dark p-8 animate-pop-in">
      <div className="flex items-center gap-2 text-[#c7cbff] text-[12px] font-semibold uppercase tracking-[0.15em]">
        <Building2 size={15} /> Set up your laboratory
      </div>
      <h2 className="mt-2 text-2xl font-bold">Your lab details &amp; login</h2>
      <p className="mt-1 text-[13px] text-white/45">These print on every report. You'll sign in with the username &amp; password next time. (You can change all of this later in Settings.)</p>

      <div className="mt-6 space-y-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">Report letterhead</div>
        <div>
          <label className={fieldLabel}>Laboratory name *</label>
          <input value={f.labName} onChange={e => set("labName")(e.target.value.toUpperCase())} placeholder="CITY DIAGNOSTIC LABORATORY" className="login-input uppercase" autoFocus />
        </div>
        <div>
          <label className={fieldLabel}>Address</label>
          <input value={f.address} onChange={e => set("address")(e.target.value)} placeholder="Main Road, Your City, District" className="login-input" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={fieldLabel}>Phone number(s)</label>
            <input value={f.phones} onChange={e => set("phones")(e.target.value)} placeholder="98xxxxxxxx / 94xxxxxxxx" className="login-input" inputMode="tel" />
          </div>
          <div>
            <label className={fieldLabel}>Timings (optional)</label>
            <input value={f.timings} onChange={e => set("timings")(e.target.value)} placeholder="8:00 am – 8:00 pm" className="login-input" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
          <div>
            <label className={fieldLabel}>Lab in-charge / signatory name *</label>
            <input value={f.incharge} onChange={e => set("incharge")(e.target.value)} placeholder="Rajesh Kumar" className="login-input" />
          </div>
          <div>
            <label className={fieldLabel}>Qualification</label>
            <input value={f.qual} onChange={e => set("qual")(e.target.value)} placeholder="DMLT" className="login-input sm:w-32" />
          </div>
        </div>

        <div className="pt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">Your login</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={fieldLabel}>Username *</label>
            <input value={f.username} onChange={e => set("username")(e.target.value)} placeholder="admin" autoCapitalize="off" spellCheck={false} className="login-input" />
          </div>
          <div>
            <label className={fieldLabel}>Password *</label>
            <input type="password" value={f.pw} onChange={e => set("pw")(e.target.value)} placeholder="••••••" className="login-input" />
          </div>
          <div>
            <label className={fieldLabel}>Confirm *</label>
            <input type="password" value={f.pw2} onChange={e => set("pw2")(e.target.value)} placeholder="••••••"
              onKeyDown={e => { if (e.key === "Enter") finish(); }} className="login-input" />
          </div>
        </div>

        {err && <p className="text-[13px] text-red-300 bg-red-500/15 border border-red-400/25 rounded-xl px-3 py-2">{err}</p>}
        <button onClick={finish} disabled={busy} className="login-btn">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <><ShieldCheck size={17} /> Finish &amp; enter</>}
        </button>
      </div>
    </div>
  );
}
