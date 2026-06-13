import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/session";
import { login, setOwnPassword, listLoginAccounts, lockoutRemainingMs } from "@/lib/queries/auth";
import { invoke, isTauri } from "@/lib/tauri";
import { User } from "@/types";
import { cn } from "@/lib/utils";
import {
  Eye, EyeOff, Lock, ShieldCheck, Zap, Database, Loader2,
  ArrowRight, AlertCircle, CheckCircle2, UserRound,
} from "lucide-react";
import { NamAstaMark } from "@/components/common/NamAstaLogo";
import { getAllSettings } from "@/lib/queries/settings";

export function LoginPage() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // forced first-run / reset password step
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);

  const [lockSeconds, setLockSeconds] = useState(0);

  const setUser = useSession(s => s.setUser);
  const navigate = useNavigate();

  const { data: version = "dev" } = useQuery({
    queryKey: ["app-version"],
    queryFn: () => (isTauri() ? invoke<string>("app_version") : Promise.resolve("dev")),
  });

  const { data: settings = {} } = useQuery({ queryKey: ["settings"], queryFn: getAllSettings });

  const { data: accounts = [] } = useQuery({
    queryKey: ["login-accounts"],
    queryFn: listLoginAccounts,
    retry: false,
  });

  // Live lockout countdown — re-enables and clears the error automatically.
  useEffect(() => {
    if (lockSeconds <= 0) return;
    const t = setInterval(() => {
      const remaining = Math.ceil(lockoutRemainingMs(username) / 1000);
      setLockSeconds(remaining);
      if (remaining <= 0) setError("");
    }, 500);
    return () => clearInterval(t);
  }, [lockSeconds, username]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await login(username.trim(), password);
      if (!res.ok || !res.user) {
        setError(res.error ?? "Invalid username or password");
        const rem = Math.ceil(lockoutRemainingMs(username) / 1000);
        if (rem > 0) setLockSeconds(rem);
        return;
      }
      if (res.mustSetPassword) { setPendingUser(res.user); return; }
      setUser(res.user);
      navigate("/dashboard");
    } catch (err) {
      setError(friendly(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPw.length < 4) { setError("Password must be at least 4 characters."); return; }
    if (newPw !== confirmPw) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      await setOwnPassword(pendingUser!.id, newPw);
      setUser({ ...pendingUser!, force_password_change: 0 });
      navigate("/dashboard");
    } catch (err) {
      setError(friendly(err));
    } finally {
      setLoading(false);
    }
  }

  const pwMatch = confirmPw.length > 0 && newPw === confirmPw;

  return (
    <div className="relative min-h-screen w-full grid lg:grid-cols-2 overflow-hidden text-white"
         style={{ background: "linear-gradient(150deg, #14161f 0%, #0e0f16 55%, #0a0b10 100%)" }}>
      {/* aurora background */}
      <div className="pointer-events-none absolute -top-32 -left-24 w-[34rem] h-[34rem] rounded-full bg-[#6366f1]/25 blur-3xl animate-float" />
      <div className="pointer-events-none absolute top-1/4 right-[-10rem] w-[30rem] h-[30rem] rounded-full bg-[#7c3aed]/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 left-1/3 w-[28rem] h-[28rem] rounded-full bg-[#22d3ee]/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.06]"
           style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "30px 30px" }} />

      {/* ── Brand hero (left) ── */}
      <aside className="relative hidden lg:flex flex-col justify-between p-14">
        <div className="relative flex items-center gap-3.5">
          <NamAstaMark size={52} animated />
          <div className="leading-tight">
            <p className="font-bold tracking-wide text-white/95">NamAsta Diagnostics</p>
            <p className="text-[11px] text-white/40 tracking-[0.18em] uppercase">Laboratory Management Suite</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-[2.7rem] font-extrabold leading-[1.08] tracking-tight">
            Fast, accurate,<br />
            <span style={{ background: "linear-gradient(120deg,#818cf8,#c7cbff 50%,#e8b4b4)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
              paperless lab reporting.
            </span>
          </h1>
          <p className="mt-5 text-white/55 leading-relaxed">
            Register patients, enter results, approve, and deliver pixel-perfect reports
            by WhatsApp &amp; email — fully offline, auto-backed-up, and error-proof.
          </p>
          <ul className="mt-9 space-y-3.5">
            <Feature icon={Zap} text="Instant search & keyboard-first workflow" />
            <Feature icon={ShieldCheck} text="Approve-lock, audit trail & role security" />
            <Feature icon={Database} text="Offline-first SQLite with daily backups" />
          </ul>
        </div>

        <p className="relative text-xs text-white/35 flex items-center gap-3">
          <span>{settings.lab_name ? `${settings.lab_name}${settings.address_line ? ` · ${settings.address_line}` : ''}` : 'NamAsta Diagnostics'} · v{version}</span>
          {import.meta.env.DEV && (
            <button
              onClick={() => { localStorage.setItem('namasta_dev_onboard', '1'); window.location.reload(); }}
              className="text-[#818cf8] hover:text-[#c7cbff] underline underline-offset-2"
            >
              Preview onboarding (dev)
            </button>
          )}
        </p>
      </aside>

      {/* ── Form (right) ── */}
      <main className="relative flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-3xl border border-white/10 glass-dark p-8 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] animate-pop-in">
          {/* mobile logo */}
          <div className="lg:hidden flex flex-col items-center mb-7">
            <NamAstaMark size={52} animated />
            <h1 className="mt-3 text-lg font-bold text-white">NamAsta Diagnostics</h1>
          </div>

          {!pendingUser ? (
            <>
              <h2 className="text-2xl font-bold text-white">Welcome back</h2>
              <p className="text-sm text-white/45 mt-1 mb-7">Sign in to continue to the lab dashboard.</p>

              <form onSubmit={handleLogin} className="space-y-5">
                <Labeled label="Username">
                  <input
                    type="text" value={username} onChange={e => setUsername(e.target.value)} required autoFocus
                    autoCapitalize="off" autoCorrect="off" spellCheck={false}
                    className="login-input" placeholder="admin" />
                  {accounts.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {accounts.map(a => (
                        <button key={a.username} type="button"
                          onClick={() => { setUsername(a.username); setError(""); }}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                            username.trim().toLowerCase() === a.username.toLowerCase()
                              ? "bg-[#6366f1]/20 border-[#818cf8]/50 text-[#c7cbff]"
                              : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                          )}>
                          <UserRound size={12} /> {a.username}
                          <span className="text-white/35">· {a.role}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </Labeled>

                <Labeled label="Password">
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"} value={password}
                      onChange={e => setPassword(e.target.value)} placeholder="Enter your password"
                      className="login-input pr-11" />
                    <ToggleEye shown={showPw} onClick={() => setShowPw(v => !v)} />
                  </div>
                  <p className="mt-1.5 text-xs text-white/40">First time? Type any password — you'll set a permanent one next.</p>
                </Labeled>

                {error && <ErrorBox msg={error} />}

                <button type="submit" disabled={loading || lockSeconds > 0} className="login-btn">
                  {loading ? <Loader2 size={18} className="animate-spin" />
                    : lockSeconds > 0 ? `Try again in ${lockSeconds}s`
                    : <>Sign in <ArrowRight size={17} /></>}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-[#c7cbff] mb-1">
                <Lock size={18} /> <span className="text-sm font-semibold uppercase tracking-wide">Secure your account</span>
              </div>
              <h2 className="text-2xl font-bold text-white">Set a new password</h2>
              <p className="text-sm text-white/45 mt-1 mb-8">
                Signed in as <span className="font-medium text-white/80">{pendingUser.display_name}</span>. Choose a password you'll remember.
              </p>

              <form onSubmit={handleSetPassword} className="space-y-5">
                <Labeled label="New password">
                  <div className="relative">
                    <input
                      type={showNewPw ? "text" : "password"} value={newPw} autoFocus
                      onChange={e => setNewPw(e.target.value)} placeholder="At least 4 characters"
                      className="login-input pr-11" />
                    <ToggleEye shown={showNewPw} onClick={() => setShowNewPw(v => !v)} />
                  </div>
                </Labeled>

                <Labeled label="Confirm password">
                  <div className="relative">
                    <input
                      type={showNewPw ? "text" : "password"} value={confirmPw}
                      onChange={e => setConfirmPw(e.target.value)} placeholder="Re-enter password"
                      className={cn("login-input pr-11", confirmPw && (pwMatch ? "!border-emerald-400/70" : "!border-red-400/60"))} />
                    {pwMatch && <CheckCircle2 size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />}
                  </div>
                </Labeled>

                {error && <ErrorBox msg={error} />}

                <button type="submit" disabled={loading || !pwMatch || newPw.length < 4} className="login-btn">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <>Set password &amp; continue <ArrowRight size={17} /></>}
                </button>
              </form>
            </>
          )}

          <p className="lg:hidden text-center text-xs text-white/35 mt-8">{settings.lab_name || 'NamAsta Diagnostics'} · v{version}</p>
        </div>
      </main>
    </div>
  );
}

function Feature({ icon: Icon, text }: { icon: typeof Zap; text: string }) {
  return (
    <li className="flex items-center gap-3 text-white/75">
      <span className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0 text-[#c7cbff]"><Icon size={16} /></span>
      <span className="text-sm">{text}</span>
    </li>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-white/65 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function ToggleEye({ shown, onClick }: { shown: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} tabIndex={-1}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors">
      {shown ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 text-sm text-red-200 bg-red-500/15 border border-red-400/25 px-3 py-2.5 rounded-xl">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <span className="break-words">{msg}</span>
    </div>
  );
}

function friendly(err: unknown): string {
  const s = String(err);
  if (s.includes("sql.execute not allowed") || s.includes("allow-execute")) {
    return "Database write permission is missing. Please restart the app (a configuration update needs to be applied).";
  }
  if (s.toLowerCase().includes("database")) return s.replace(/^Error:\s*/, "");
  return s.replace(/^Error:\s*/, "") || "Something went wrong. Please try again.";
}
