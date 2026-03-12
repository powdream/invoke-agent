import { join } from 'node:path';

const DEFAULT_DB_PATH = join(process.cwd(), '.invoke-agent', 'communication.db');

interface DbOptions {
  db?: string;
  databasePath?: string;
  [key: string]: unknown;
}

export function resolveDbPath(options: DbOptions): string {
  return options.db ?? options.databasePath ?? DEFAULT_DB_PATH;
}
