import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { Suspense, lazy, Component, useState, useEffect, type ReactNode } from "react";
import { useSession } from "@/lib/session";
import { AppShell } from "@/app/AppShell";
import { DialogHost } from "@/lib/dialog";
import { ToastHost } from "@/lib/toast";
import { getLicenseStatus, type LicenseStatus } from "@/lib/license";
import { needsSetup, resetInstallForTesting } from "@/lib/onboarding";
import { NamAstaMark } from "@/components/common/NamAstaLogo";
import { useNavigate as useNav } from "react-router-dom";

// Catches a failed lazy-chunk load (e.g. after an update swaps chunk hashes) so the app
// shows a recoverable message instead of a blank white screen.
class ChunkErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) {
      return (
        <div className="flex flex-col items-center justify-center h-screen gap-3 text-center px-6">
          <p className="text-[15px] font-semibold text-[#14151c]">Something didn’t load correctly.</p>
          <p className="text-[13px] text-[#8a8b97]">Please reload the app.</p>
          <button onClick={() => window.location.reload()} className="btn btn-primary mt-1">Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Route-level code-splitting (§7D.2): each page's JS loads on first visit, then is cached.
const LoginPage = lazy(() => import("@/pages/login/LoginPage").then(m => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import("@/pages/dashboard/DashboardPage").then(m => ({ default: m.DashboardPage })));
const NewPatientPage = lazy(() => import("@/pages/new-patient/NewPatientPage").then(m => ({ default: m.NewPatientPage })));
const ResultEntryPage = lazy(() => import("@/pages/result-entry/ResultEntryPage").then(m => ({ default: m.ResultEntryPage })));
const ReportPreviewPage = lazy(() => import("@/pages/report/ReportPreviewPage").then(m => ({ default: m.ReportPreviewPage })));
const PatientsPage = lazy(() => import("@/pages/patients/PatientsPage").then(m => ({ default: m.PatientsPage })));
const TestMasterPage = lazy(() => import("@/pages/test-master/TestMasterPage").then(m => ({ default: m.TestMasterPage })));
const DoctorsPage = lazy(() => import("@/pages/doctors/DoctorsPage").then(m => ({ default: m.DoctorsPage })));
const BizReportsPage = lazy(() => import("@/pages/reports/BizReportsPage").then(m => ({ default: m.BizReportsPage })));
const SettingsPage = lazy(() => import("@/pages/settings/SettingsPage").then(m => ({ default: m.SettingsPage })));
const OnboardingPage = lazy(() => import("@/pages/activation/OnboardingPage").then(m => ({ default: m.OnboardingPage })));

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
      <span className="w-4 h-4 border-2 border-gray-300 border-t-maroon-600 rounded-full animate-spin mr-2" />
      Loading…
    </div>
  );
}

// Key these pages by patient id so navigating between patients fully remounts them.
// Otherwise per-instance refs (auto-send/auto-email latches) and in-progress edit state
// leak across patients — causing missed or wrong-patient sends.
function ResultEntryRoute() {
  const { patientId } = useParams();
  return <ResultEntryPage key={patientId} />;
}
function ReportRoute() {
  const { patientId } = useParams();
  return <ReportPreviewPage key={patientId} />;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useSession(s => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const user = useSession(s => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Full-screen brand splash while the licence is being checked at startup. */
function LicenseSplash() {
  return (
    <div className="flex h-screen items-center justify-center" style={{ background: "linear-gradient(150deg,#14161f,#0a0b10)" }}>
      <div className="animate-pulse"><NamAstaMark size={64} animated /></div>
    </div>
  );
}

/** Licence + onboarding gate. Development is never gated (admin/admin123 works straight away).
 *  In production: no/expired licence OR a first-run (no account yet) → the onboarding wizard
 *  (pay & activate, then name the lab + create login). An activated, set-up lab → sign in. */
type GatePhase =
  | { kind: "loading" }
  | { kind: "onboard"; licensed: boolean; needSetup: boolean; status: LicenseStatus; preview?: boolean }
  | { kind: "app" };

function LicenseGate() {
  const [phase, setPhase] = useState<GatePhase>({ kind: "loading" });
  const check = async () => {
    try {
      // "Set up a new laboratory" was tapped on the login screen — show onboarding on demand.
      const showOnboard = localStorage.getItem("namasta_show_onboard") === "1";
      const status = await getLicenseStatus();          // dev → active:true (no payment)
      if (status.dev && !showOnboard) { setPhase({ kind: "app" }); return; }   // developer just enters
      const setup = await needsSetup();
      if (showOnboard) { setPhase({ kind: "onboard", licensed: status.active, needSetup: setup, status, preview: true }); return; }
      // Active subscriber who's already set up → straight to sign-in (no re-filling, ever).
      if (status.active && !setup) { setPhase({ kind: "app" }); return; }
      if (status.active && setup) { setPhase({ kind: "onboard", licensed: true, needSetup: true, status }); return; }
      setPhase({ kind: "onboard", licensed: false, needSetup: setup, status });   // no/expired licence → renew
    } catch {
      setPhase({ kind: "onboard", licensed: false, needSetup: true, status: { active: false } });
    }
  };
  useEffect(() => {
    check();
    // Strict enforcement: re-check every minute and whenever the window regains focus, so a
    // subscription that lapses mid-session immediately drops the user onto the renew screen.
    const iv = setInterval(check, 60_000);
    const onVis = () => { if (!document.hidden) check(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase.kind === "loading") return <LicenseSplash />;
  if (phase.kind === "onboard") {
    return (
      <Suspense fallback={<LicenseSplash />}>
        <OnboardingPage licensed={phase.licensed} needSetup={phase.needSetup} status={phase.status} preview={phase.preview} onDone={check} />
      </Suspense>
    );
  }
  return (
    <ChunkErrorBoundary>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="new-patient" element={<NewPatientPage />} />
            <Route path="result-entry/:patientId" element={<ResultEntryRoute />} />
            <Route path="report/:patientId" element={<ReportRoute />} />
            <Route path="patients" element={<PatientsPage />} />
            <Route path="test-master" element={<RequireAdmin><TestMasterPage /></RequireAdmin>} />
            <Route path="doctors" element={<DoctorsPage />} />
            <Route path="reports" element={<BizReportsPage />} />
            <Route path="settings" element={<RequireAdmin><SettingsPage /></RequireAdmin>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
          {/* Dev-only reset route — compiled out in production by Vite (DEV=false constant). */}
          {import.meta.env.DEV && <Route path="/dev/reset" element={<DevResetPage />} />}
        </Routes>
      </Suspense>
    </ChunkErrorBoundary>
  );
}

/**
 * Dev-only testing page at /dev/reset.
 * Resets the install to genuine first-run so the full new-customer flow
 * (pay → key → setup form → dashboard) can be walked through again.
 * This route is ONLY compiled in when import.meta.env.DEV is true —
 * Vite replaces it with `false` in production builds and the dead code
 * is removed entirely, so customers can never reach this page.
 */
function DevResetPage() {
  const navigate = useNav();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function reset() {
    setBusy(true);
    await resetInstallForTesting();
    localStorage.removeItem("namasta_show_onboard");
    useSession.getState().logout();
    setDone(true);
    setBusy(false);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0c1a3e", fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "#ffffff10", border: "1px solid #ffffff20", borderRadius: 20, padding: 40, maxWidth: 420, width: "100%", textAlign: "center" }}>
        <p style={{ color: "#f59e0b", fontSize: 12, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>Dev only — never shown in production</p>
        <h1 style={{ color: "#ffffff", fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Reset to first-run</h1>
        <p style={{ color: "#ffffff80", fontSize: 13, lineHeight: 1.6, marginBottom: 28 }}>
          Clears <code style={{ color: "#a5f3fc" }}>setup_done</code>, <code style={{ color: "#a5f3fc" }}>license_key</code> and resets the admin to the seeded placeholder.
          After reset the full new-customer flow runs: pay → key → setup form → dashboard.
        </p>
        {done ? (
          <div>
            <p style={{ color: "#4ade80", fontWeight: 600, marginBottom: 16 }}>✓ Reset complete</p>
            <button onClick={() => { window.location.href = "/"; }} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
              Go to app →
            </button>
          </div>
        ) : (
          <button onClick={reset} disabled={busy} style={{ background: busy ? "#6366f180" : "#ef4444", color: "#fff", border: "none", borderRadius: 10, padding: "12px 28px", fontWeight: 700, cursor: busy ? "default" : "pointer", fontSize: 15 }}>
            {busy ? "Resetting…" : "Reset install"}
          </button>
        )}
        <p style={{ marginTop: 20 }}>
          <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: "#ffffff50", cursor: "pointer", fontSize: 13 }}>← go back</button>
        </p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <DialogHost />
      <ToastHost />
      <LicenseGate />
    </BrowserRouter>
  );
}
