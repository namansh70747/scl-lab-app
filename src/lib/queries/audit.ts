import { getDb } from '@/lib/db';

export async function writeAudit(
  userId: number | null,
  action: string,
  entity: string,
  entityId: number | null,
  before?: unknown,
  after?: unknown
): Promise<void> {
  const db = await getDb();
  await db.execute(
    'INSERT INTO audit_log(user_id,action,entity,entity_id,before_json,after_json,at) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP)',
    [userId, action, entity, entityId, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null]
  );
}
