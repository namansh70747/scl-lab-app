import { dbQuery, dbExecute } from '@/lib/db';

export interface PendingDelivery {
  patient_id: number;
  patient_name: string;
  test_no: number;
  phone: string | null;
}

export async function logDelivery(
  patientId: number, channel: string, target: string,
  status: string, error?: string
): Promise<void> {
  await dbExecute(
    'INSERT INTO delivery_log(patient_id,channel,target,status,error,at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)',
    [patientId, channel, target, status, error ?? null]
  );
}

/** True if this patient already had a successful delivery on the given channel (dedupe auto-send). */
export async function hasDelivered(patientId: number, channel: string): Promise<boolean> {
  const rows = await dbQuery<{ n: number }>(
    "SELECT COUNT(*) as n FROM delivery_log WHERE patient_id=? AND channel=? AND status IN ('sent','delivered')",
    [patientId, channel]
  );
  return (rows[0]?.n ?? 0) > 0;
}

export async function getPendingDeliveries(): Promise<PendingDelivery[]> {
  // Only a real patient delivery (WhatsApp/Email/SMS) clears a patient from the tray —
  // printing or saving a PDF locally is NOT sending it to the patient. And only show patients
  // we can actually message: a walk-in with no phone number must NOT sit here as a false
  // "still to send" reminder.
  return dbQuery<PendingDelivery>(
    `SELECT p.id as patient_id, p.name as patient_name, p.test_no, p.phone
     FROM patients p
     LEFT JOIN delivery_log dl ON dl.patient_id=p.id AND dl.status IN ('sent','delivered')
        AND dl.channel IN ('whatsapp_api','whatsapp_semi','email','sms')
     WHERE p.report_time IS NOT NULL AND dl.id IS NULL
       AND p.phone IS NOT NULL AND TRIM(p.phone) <> ''
     ORDER BY p.report_time DESC LIMIT 50`
  );
}

export async function updateDeliveryStatus(id: number, status: string, error?: string): Promise<void> {
  await dbExecute(
    'UPDATE delivery_log SET status=?,error=? WHERE id=?',
    [status, error ?? null, id]
  );
}
