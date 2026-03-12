import { join, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
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

export function createStorage(options: DbOptions): Storage & Disposable {
  const dbPath = resolveDbPath(options);
  mkdirSync(dirname(dbPath), { recursive: true });
  const storage = new SqliteStorage(new Database(dbPath));
  return {
    sessionId: storage.sessionId,
    output: storage.output,
    close: () => storage.close(),
    [Symbol.dispose](): void {
      storage.close();
    },
  };
}
