import { dbQuery, dbExecute } from '@/lib/db';
import { DeliveryLog } from '@/types';

export async function logDelivery(
  patientId: number, channel: string, target: string,
  status: string, error?: string
): Promise<void> {
  await dbExecute(
    'INSERT INTO delivery_log(patient_id,channel,target,status,error,at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)',
    [patientId, channel, target, status, error ?? null]
  );
}

export async function getPendingDeliveries(): Promise<(DeliveryLog & { patient_name: string; test_no: number })[]> {
  return dbQuery(
    `SELECT dl.*, p.name as patient_name, p.test_no, p.phone
     FROM patients p
     LEFT JOIN delivery_log dl ON dl.patient_id=p.id AND dl.status IN ('sent','delivered')
     WHERE p.report_time IS NOT NULL AND dl.id IS NULL
     ORDER BY p.report_time DESC LIMIT 50`
  );
}

export async function updateDeliveryStatus(id: number, status: string, error?: string): Promise<void> {
  await dbExecute(
    'UPDATE delivery_log SET status=?,error=? WHERE id=?',
    [status, error ?? null, id]
  );
}
