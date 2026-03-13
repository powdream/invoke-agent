import { Database } from 'bun:sqlite';
import { randomUUID } from 'node:crypto';
import type {
  AgentSessionId,
  AgentType,
  OutputId,
  OutputRecord,
  OutputStorage,
  ThreadStorage,
  ThreadTurn,
  ThreadSummary,
  Storage,
} from '@lib/storage/types';

const SCHEMA_VERSION = 3;

export class SqliteStorage implements Storage {
  threads: ThreadStorage;
  output: OutputStorage;

  constructor(private db: Database) {
    this.migrateIfNeeded();
    this.threads = new SqliteThreadStorage(this.db);
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
    this.db.run(`DROP TABLE IF EXISTS session_threads`);
    this.db.run(`DROP TABLE IF EXISTS session_summaries`);
    this.db.run(`DROP TABLE IF EXISTS outputs`);
  }

  private createTables(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS session_threads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        requester_type TEXT NOT NULL,
        requester_session_id TEXT NOT NULL,
        responder_type TEXT NOT NULL,
        responder_session_id TEXT NOT NULL,
        prompt TEXT NOT NULL,
        output_id TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_session_threads_requester ON session_threads(requester_type, requester_session_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_session_threads_responder ON session_threads(responder_type, responder_session_id)`);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS session_summaries (
        responder_type TEXT NOT NULL,
        responder_session_id TEXT NOT NULL,
        summary TEXT NOT NULL,
        last_thread_id INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (responder_type, responder_session_id)
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

class SqliteThreadStorage implements ThreadStorage {
  constructor(private db: Database) {}

  async lookupLastSessionId(requester: AgentSessionId, targetAgentType: AgentType): Promise<string | null> {
    const query = `
      SELECT responder_session_id 
      FROM session_threads 
      WHERE requester_type = ? AND requester_session_id = ? AND responder_type = ?
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    const result = this.db.query(query).get(requester.type, requester.sessionId, targetAgentType) as { responder_session_id: string } | null;
    return result ? result.responder_session_id : null;
  }

  async append(params: { requester: AgentSessionId; responder: AgentSessionId; prompt: string; outputId: string }): Promise<void> {
    const query = `
      INSERT INTO session_threads (
        requester_type, requester_session_id, 
        responder_type, responder_session_id, 
        prompt, output_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    this.db.run(query, [
      params.requester.type, params.requester.sessionId,
      params.responder.type, params.responder.sessionId,
      params.prompt, params.outputId, Date.now()
    ]);
  }

  async listByRequester(requester: AgentSessionId): Promise<AgentSessionId[]> {
    const query = `
      SELECT DISTINCT responder_type, responder_session_id
      FROM session_threads
      WHERE requester_type = ? AND requester_session_id = ?
    `;
    const results = this.db.query(query).all(requester.type, requester.sessionId) as { responder_type: string, responder_session_id: string }[];
    return results.map(r => ({ type: r.responder_type as AgentType, sessionId: r.responder_session_id }));
  }

  async getThreadHistory(responder: AgentSessionId): Promise<ThreadTurn[]> {
    const query = `
      SELECT id, requester_type, requester_session_id, responder_type, responder_session_id, prompt, output_id, created_at
      FROM session_threads
      WHERE responder_type = ? AND responder_session_id = ?
      ORDER BY id ASC
    `;
    const results = this.db.query(query).all(responder.type, responder.sessionId) as {
      id: number;
      requester_type: string;
      requester_session_id: string;
      responder_type: string;
      responder_session_id: string;
      prompt: string;
      output_id: string;
      created_at: number;
    }[];

    return results.map(r => ({
      id: r.id,
      requesterType: r.requester_type as AgentType,
      requesterSessionId: r.requester_session_id,
      responderType: r.responder_type as AgentType,
      responderSessionId: r.responder_session_id,
      prompt: r.prompt,
      outputId: r.output_id,
      createdAt: r.created_at,
    }));
  }

  async getSummary(responder: AgentSessionId): Promise<ThreadSummary | null> {
    const query = `
      SELECT responder_type, responder_session_id, summary, last_thread_id, updated_at
      FROM session_summaries
      WHERE responder_type = ? AND responder_session_id = ?
    `;
    const result = this.db.query(query).get(responder.type, responder.sessionId) as {
      responder_type: string;
      responder_session_id: string;
      summary: string;
      last_thread_id: number;
      updated_at: number;
    } | null;

    if (!result) return null;

    return {
      responderType: result.responder_type as AgentType,
      responderSessionId: result.responder_session_id,
      summary: result.summary,
      lastThreadId: result.last_thread_id,
      updatedAt: result.updated_at,
    };
  }

  async saveSummary(params: { responder: AgentSessionId; summary: string; lastThreadId: number }): Promise<void> {
    const query = `
      INSERT INTO session_summaries (responder_type, responder_session_id, summary, last_thread_id, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(responder_type, responder_session_id) DO UPDATE SET
        summary = excluded.summary,
        last_thread_id = excluded.last_thread_id,
        updated_at = excluded.updated_at
    `;
    this.db.run(query, [
      params.responder.type, params.responder.sessionId,
      params.summary, params.lastThreadId, Date.now()
    ]);
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
