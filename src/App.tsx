import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { useSession } from "@/lib/session";
import { AppShell } from "@/app/AppShell";

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

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
      <span className="w-4 h-4 border-2 border-gray-300 border-t-maroon-600 rounded-full animate-spin mr-2" />
      Loading…
    </div>
  );
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

export default function App() {
  return (
    <BrowserRouter>
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
            <Route path="result-entry/:patientId" element={<ResultEntryPage />} />
            <Route path="report/:patientId" element={<ReportPreviewPage />} />
            <Route path="patients" element={<PatientsPage />} />
            <Route path="test-master" element={<RequireAdmin><TestMasterPage /></RequireAdmin>} />
            <Route path="doctors" element={<DoctorsPage />} />
            <Route path="reports" element={<BizReportsPage />} />
            <Route path="settings" element={<RequireAdmin><SettingsPage /></RequireAdmin>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
