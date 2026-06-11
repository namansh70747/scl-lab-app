import Database from '@tauri-apps/plugin-sql';

let _db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (_db) return _db;
  _db = await Database.load('sqlite:scl.db');
  // Apply performance pragmas
  await _db.execute('PRAGMA journal_mode=WAL');
  await _db.execute('PRAGMA synchronous=NORMAL');
  await _db.execute('PRAGMA foreign_keys=ON');
  await _db.execute('PRAGMA busy_timeout=5000');
  await _db.execute('PRAGMA temp_store=MEMORY');
  await _db.execute('PRAGMA cache_size=-16000');
  return _db;
}

export async function dbQuery<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb();
  return db.select<T[]>(sql, params);
}

export async function dbExecute(sql: string, params: unknown[] = []): Promise<void> {
  const db = await getDb();
  await db.execute(sql, params);
}

export async function dbTransaction(operations: ((db: Database) => Promise<void>)): Promise<void> {
  const db = await getDb();
  await db.execute('BEGIN');
  try {
    await operations(db);
    await db.execute('COMMIT');
  } catch (err) {
    await db.execute('ROLLBACK');
    throw err;
  }
}
