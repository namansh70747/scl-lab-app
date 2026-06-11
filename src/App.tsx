import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useSession } from "@/lib/session";
import { AppShell } from "@/app/AppShell";
import { LoginPage } from "@/pages/login/LoginPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { NewPatientPage } from "@/pages/new-patient/NewPatientPage";
import { ResultEntryPage } from "@/pages/result-entry/ResultEntryPage";
import { ReportPreviewPage } from "@/pages/report/ReportPreviewPage";
import { PatientsPage } from "@/pages/patients/PatientsPage";
import { TestMasterPage } from "@/pages/test-master/TestMasterPage";
import { DoctorsPage } from "@/pages/doctors/DoctorsPage";
import { BizReportsPage } from "@/pages/reports/BizReportsPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useSession(s => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
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
          <Route path="test-master" element={<TestMasterPage />} />
          <Route path="doctors" element={<DoctorsPage />} />
          <Route path="reports" element={<BizReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
