import { dbQuery, dbExecute } from "@/lib/db";
import type { AnalyzerHistograms } from "@/lib/astm";

/** Persist the histogram curves captured from the analyzer for a patient. */
export async function saveHistograms(patientId: number, histos: AnalyzerHistograms): Promise<void> {
  if (!histos || (!histos.wbc && !histos.rbc && !histos.plt)) return;
  await dbExecute(
    `INSERT INTO analyzer_histograms(patient_id, data_json, at) VALUES(?,?,CURRENT_TIMESTAMP)
       ON CONFLICT(patient_id) DO UPDATE SET data_json=excluded.data_json, at=CURRENT_TIMESTAMP`,
    [patientId, JSON.stringify(histos)],
  );
}

/** Load the stored histogram curves for a patient (for the CBC report). */
export async function getHistograms(patientId: number): Promise<AnalyzerHistograms | null> {
  const rows = await dbQuery<{ data_json: string }>(
    "SELECT data_json FROM analyzer_histograms WHERE patient_id=?",
    [patientId],
  );
  if (!rows[0]) return null;
  try {
    return JSON.parse(rows[0].data_json) as AnalyzerHistograms;
  } catch {
    return null;
  }
}
