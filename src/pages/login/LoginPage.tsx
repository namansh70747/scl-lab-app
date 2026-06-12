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
import { BrandLogo } from "@/components/common/SCLLogo";
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
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-white">
      {/* ── Brand hero (left) ── */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 text-white
                        bg-gradient-to-br from-[#7b1b1b] via-[#8f2424] to-[#4d0f0f]">
        {/* decorative glow */}
        <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 w-96 h-96 rounded-full bg-[#1e4fa3]/30 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]"
             style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "28px 28px" }} />

        <div className="relative flex items-center gap-3.5">
          <div className="bg-white rounded-2xl px-3 py-2 shadow-lg">
            <BrandLogo src={settings.logo_data} height={30} />
          </div>
          <div className="leading-tight">
            <p className="font-bold tracking-wide text-white/95">Sharma Clinical Laboratory</p>
            <p className="text-[11px] text-white/50 tracking-[0.16em] uppercase">Fully Computerised Hi-Tech Lab</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-tight">Fast, accurate, <br />paperless lab reporting.</h1>
          <p className="mt-4 text-white/70 leading-relaxed">
            Register patients, enter results, approve, and deliver pixel-perfect reports
            by WhatsApp &amp; email — fully offline, auto-backed-up, and error-proof.
          </p>
          <ul className="mt-8 space-y-3">
            <Feature icon={Zap} text="Instant search & keyboard-first workflow" />
            <Feature icon={ShieldCheck} text="Approve-lock, audit trail & role security" />
            <Feature icon={Database} text="Offline-first SQLite with daily backups" />
          </ul>
        </div>

        <p className="relative text-xs text-white/50">
          G.T. Road, Village Nangal Bhur, Teh. &amp; Distt. Pathankot · v{version}
        </p>
      </aside>

      {/* ── Form (right) ── */}
      <main className="flex items-center justify-center p-6 bg-gradient-to-b from-maroon-50/40 to-white">
        <div className="w-full max-w-sm">
          {/* mobile logo */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <BrandLogo src={settings.logo_data} height={44} />
            <h1 className="mt-3 text-lg font-bold text-maroon-700">Sharma Clinical Laboratory</h1>
          </div>

          {!pendingUser ? (
            <>
              <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
              <p className="text-sm text-gray-500 mt-1 mb-8">Sign in to continue to the lab dashboard.</p>

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
                              ? "bg-maroon-50 border-maroon-300 text-maroon-700"
                              : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                          )}>
                          <UserRound size={12} /> {a.username}
                          <span className="text-gray-400">· {a.role}</span>
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
                  <p className="mt-1.5 text-xs text-gray-400">First time? Type any password — you'll set a permanent one next.</p>
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
              <div className="flex items-center gap-2 text-maroon-700 mb-1">
                <Lock size={18} /> <span className="text-sm font-semibold uppercase tracking-wide">Secure your account</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Set a new password</h2>
              <p className="text-sm text-gray-500 mt-1 mb-8">
                Signed in as <span className="font-medium text-gray-700">{pendingUser.display_name}</span>. Choose a password you'll remember.
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
                      className={cn("login-input pr-11", confirmPw && (pwMatch ? "border-green-400 focus:ring-green-500" : "border-red-300"))} />
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

          <p className="lg:hidden text-center text-xs text-gray-400 mt-8">Nangal Bhur, Pathankot · v{version}</p>
        </div>
      </main>
    </div>
  );
}

function Feature({ icon: Icon, text }: { icon: typeof Zap; text: string }) {
  return (
    <li className="flex items-center gap-3 text-white/85">
      <span className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0"><Icon size={16} /></span>
      <span className="text-sm">{text}</span>
    </li>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function ToggleEye({ shown, onClick }: { shown: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} tabIndex={-1}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
      {shown ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 px-3 py-2.5 rounded-lg">
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
