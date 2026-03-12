import { Database } from 'bun:sqlite';
import { randomUUID } from 'node:crypto';
import type {
  AgentSessionId,
  AgentType,
  LookupSessionIdParams,
  OutputId,
  OutputRecord,
  OutputStorage,
  SessionIdStorage,
  Storage,
} from '@lib/storage/types';

const SCHEMA_VERSION = 2;

const AGENT_COLUMN_MAP = {
  gemini: 'gemini_session_id',
  'cursor-agent': 'cursor_agent_session_id',
  claude: 'claude_session_id',
} as const;

export class SqliteStorage implements Storage {
  sessionId: SessionIdStorage;
  output: OutputStorage;

  constructor(private db: Database) {
    this.migrateIfNeeded();
    this.sessionId = new SqliteSessionIdStorage(this.db);
    this.output = new SqliteOutputStorage(this.db);
  }

  close(): void {
    this.db.close();
  }

  private migrateIfNeeded(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS schema_meta (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);

    const result = this.db.query(`SELECT value FROM schema_meta WHERE key = 'version'`).get() as {
      value: string;
    } | null;

    const currentVersion = result ? parseInt(result.value, 10) : 0;

    if (currentVersion !== SCHEMA_VERSION) {
      this.dropAllTables();
      this.createTables();
      this.db.run(`INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('version', ?)`, [
        SCHEMA_VERSION.toString(),
      ]);
    }
  }

  private dropAllTables(): void {
    this.db.run(`DROP TABLE IF EXISTS session_bindings`);
    this.db.run(`DROP TABLE IF EXISTS outputs`);
  }

  private createTables(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS session_bindings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gemini_session_id TEXT,
        cursor_agent_session_id TEXT,
        claude_session_id TEXT,
        UNIQUE(gemini_session_id),
        UNIQUE(cursor_agent_session_id),
        UNIQUE(claude_session_id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS outputs (
        id TEXT PRIMARY KEY,
        stdout TEXT NOT NULL,
        stderr TEXT,
        file_content TEXT,
        status_code INTEGER
      )
    `);
  }
}

class SqliteSessionIdStorage implements SessionIdStorage {
  constructor(private db: Database) {}

  async lookup(params: LookupSessionIdParams): Promise<string | null> {
    const targetColumn = AGENT_COLUMN_MAP[params.target];
    const byColumn = AGENT_COLUMN_MAP[params.by.type];

    const query = `SELECT ${targetColumn} FROM session_bindings WHERE ${byColumn} = ?`;
    const result = this.db.query(query).get(params.by.sessionId) as Record<string, string> | null;

    return result ? result[targetColumn] : null;
  }

  async bind<T extends AgentType>(
    from: AgentSessionId<T>,
    to: AgentSessionId<Exclude<AgentType, T>>,
  ): Promise<void> {
    const fromColumn = AGENT_COLUMN_MAP[from.type];
    const toColumn = AGENT_COLUMN_MAP[to.type];

    const existing = this.db
      .query(`SELECT id FROM session_bindings WHERE ${fromColumn} = ? OR ${toColumn} = ?`)
      .get(from.sessionId, to.sessionId) as { id: number } | null;

    if (existing) {
      this.db.run(`UPDATE session_bindings SET ${fromColumn} = ?, ${toColumn} = ? WHERE id = ?`, [
        from.sessionId,
        to.sessionId,
        existing.id,
      ]);
    } else {
      this.db.run(`INSERT INTO session_bindings (${fromColumn}, ${toColumn}) VALUES (?, ?)`, [
        from.sessionId,
        to.sessionId,
      ]);
    }
  }
}

class SqliteOutputStorage implements OutputStorage {
  constructor(private db: Database) {}

  async lookup(outputId: OutputId): Promise<OutputRecord | null> {
    const result = this.db
      .query(`SELECT stdout, stderr, file_content, status_code FROM outputs WHERE id = ?`)
      .get(outputId) as {
      stdout: string;
      stderr: string | null;
      file_content: string | null;
      status_code: number | null;
    } | null;

    if (!result) return null;

    return {
      stdout: result.stdout,
      stderr: result.stderr ?? undefined,
      fileContent: result.file_content ?? undefined,
      statusCode: result.status_code ?? undefined,
    };
  }

  async put(options: OutputRecord): Promise<OutputId> {
    const id = randomUUID();

    this.db.run(
      `INSERT INTO outputs (id, stdout, stderr, file_content, status_code) VALUES (?, ?, ?, ?, ?)`,
      [
        id,
        options.stdout,
        options.stderr ?? null,
        options.fileContent ?? null,
        options.statusCode ?? null,
      ],
    );

    return id;
  }
}
