import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { Suspense, lazy, Component, useState, useEffect, type ReactNode } from "react";
import { useSession } from "@/lib/session";
import { AppShell } from "@/app/AppShell";
import { DialogHost } from "@/lib/dialog";
import { ToastHost } from "@/lib/toast";
import { getLicenseStatus, type LicenseStatus } from "@/lib/license";
import { needsSetup } from "@/lib/onboarding";
import { NamAstaMark } from "@/components/common/NamAstaLogo";

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
  | { kind: "onboard"; licensed: boolean; status: LicenseStatus }
  | { kind: "app" };

function LicenseGate() {
  const [phase, setPhase] = useState<GatePhase>({ kind: "loading" });
  const check = async () => {
    try {
      const status = await getLicenseStatus();   // dev → active:true (no payment), but still first-run setup
      if (!status.active) { setPhase({ kind: "onboard", licensed: false, status }); return; }
      const setup = await needsSetup();
      setPhase(setup ? { kind: "onboard", licensed: true, status } : { kind: "app" });
    } catch {
      setPhase({ kind: "onboard", licensed: false, status: { active: false } });
    }
  };
  useEffect(() => { check(); }, []);

  if (phase.kind === "loading") return <LicenseSplash />;
  if (phase.kind === "onboard") {
    return (
      <Suspense fallback={<LicenseSplash />}>
        <OnboardingPage licensed={phase.licensed} status={phase.status} onDone={check} />
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
        </Routes>
      </Suspense>
    </ChunkErrorBoundary>
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
