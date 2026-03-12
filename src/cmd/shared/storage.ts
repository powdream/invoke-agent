import { join } from 'node:path';
import { Database } from 'bun:sqlite';
import type { Storage } from '@lib/storage';
import { SqliteStorage } from '@lib/storage';

const DEFAULT_DB_PATH = join(process.cwd(), '.invoke-agent', 'communication.db');

export interface DbOptions {
  db?: string;
  databasePath?: string;
  [key: string]: unknown;
}

function resolveDbPath(options: DbOptions): string {
  return options.db ?? options.databasePath ?? DEFAULT_DB_PATH;
}

export function createStorage(options: DbOptions): Storage {
  const dbPath = resolveDbPath(options);
  return new SqliteStorage(new Database(dbPath));
}
