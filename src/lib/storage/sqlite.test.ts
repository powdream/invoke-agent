import { Database } from 'bun:sqlite';
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { SqliteStorage } from '@lib/storage/sqlite';

describe('SqliteStorage', () => {
  let db: Database;
  let storage: SqliteStorage;

  beforeEach(() => {
    db = new Database(':memory:');
    storage = new SqliteStorage(db);
  });

  afterEach(() => {
    storage.close();
  });

  describe('schema migration', () => {
    test('creates tables on fresh database', () => {
      const tables = db
        .query(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
        .all() as { name: string }[];

      const tableNames = tables.map((t) => t.name);
      expect(tableNames).toContain('schema_meta');
      expect(tableNames).toContain('session_bindings');
      expect(tableNames).toContain('outputs');
    });

    test('sets schema version on fresh database', () => {
      const result = db.query(`SELECT value FROM schema_meta WHERE key = 'version'`).get() as {
        value: string;
      };

      expect(result.value).toBe('2');
    });

    test('skips migration when schema version matches', () => {
      const before = db.query(`SELECT value FROM schema_meta WHERE key = 'version'`).get();

      new SqliteStorage(db);

      const after = db.query(`SELECT value FROM schema_meta WHERE key = 'version'`).get();
      expect(after).toEqual(before);
    });

    test('drops and recreates tables when schema version differs', () => {
      db.run(`INSERT INTO outputs (id, stdout) VALUES ('test-id', 'test-output')`);
      db.run(`UPDATE schema_meta SET value = '0' WHERE key = 'version'`);

      new SqliteStorage(db);

      const result = db.query(`SELECT COUNT(*) as count FROM outputs`).get() as { count: number };
      expect(result.count).toBe(0);
    });
  });

  describe('close', () => {
    test('closes the database connection', () => {
      const testDb = new Database(':memory:');
      const testStorage = new SqliteStorage(testDb);

      testStorage.close();

      expect(() => testDb.query('SELECT 1').get()).toThrow();
    });
  });

  describe('SessionIdStorage', () => {
    describe('lookup', () => {
      test('returns null when no binding exists', async () => {
        const result = await storage.sessionId.lookup({
          target: 'gemini',
          by: { type: 'claude', sessionId: 'claude-123' },
        });

        expect(result).toBeNull();
      });

      test('returns session ID when binding exists', async () => {
        await storage.sessionId.bind(
          { type: 'gemini', sessionId: 'gemini-123' },
          { type: 'claude', sessionId: 'claude-123' },
        );

        const result = await storage.sessionId.lookup({
          target: 'gemini',
          by: { type: 'claude', sessionId: 'claude-123' },
        });

        expect(result).toBe('gemini-123');
      });

      test('returns null when querying by unbound session', async () => {
        await storage.sessionId.bind(
          { type: 'gemini', sessionId: 'gemini-123' },
          { type: 'claude', sessionId: 'claude-123' },
        );

        const result = await storage.sessionId.lookup({
          target: 'gemini',
          by: { type: 'cursor-agent', sessionId: 'cursor-456' },
        });

        expect(result).toBeNull();
      });

      test('works with all agent type combinations', async () => {
        await storage.sessionId.bind(
          { type: 'cursor-agent', sessionId: 'cursor-123' },
          { type: 'claude', sessionId: 'claude-123' },
        );

        const result = await storage.sessionId.lookup({
          target: 'cursor-agent',
          by: { type: 'claude', sessionId: 'claude-123' },
        });

        expect(result).toBe('cursor-123');
      });
    });

    describe('bind', () => {
      test('creates new binding when none exists', async () => {
        await storage.sessionId.bind(
          { type: 'gemini', sessionId: 'gemini-123' },
          { type: 'claude', sessionId: 'claude-123' },
        );

        const row = db.query(`SELECT * FROM session_bindings`).get() as Record<string, unknown>;
        expect(row.gemini_session_id).toBe('gemini-123');
        expect(row.claude_session_id).toBe('claude-123');
      });

      test('updates existing binding when from session already bound', async () => {
        await storage.sessionId.bind(
          { type: 'gemini', sessionId: 'gemini-123' },
          { type: 'claude', sessionId: 'claude-123' },
        );

        await storage.sessionId.bind(
          { type: 'gemini', sessionId: 'gemini-123' },
          { type: 'cursor-agent', sessionId: 'cursor-456' },
        );

        const rows = db.query(`SELECT * FROM session_bindings`).all();
        expect(rows).toHaveLength(1);

        const row = rows[0] as Record<string, unknown>;
        expect(row.gemini_session_id).toBe('gemini-123');
        expect(row.cursor_agent_session_id).toBe('cursor-456');
      });

      test('updates existing binding when to session already bound', async () => {
        await storage.sessionId.bind(
          { type: 'gemini', sessionId: 'gemini-123' },
          { type: 'claude', sessionId: 'claude-123' },
        );

        await storage.sessionId.bind(
          { type: 'cursor-agent', sessionId: 'cursor-456' },
          { type: 'claude', sessionId: 'claude-123' },
        );

        const rows = db.query(`SELECT * FROM session_bindings`).all();
        expect(rows).toHaveLength(1);

        const row = rows[0] as Record<string, unknown>;
        expect(row.cursor_agent_session_id).toBe('cursor-456');
        expect(row.claude_session_id).toBe('claude-123');
      });

      test('can bind all three agent types together', async () => {
        await storage.sessionId.bind(
          { type: 'gemini', sessionId: 'gemini-123' },
          { type: 'claude', sessionId: 'claude-123' },
        );

        await storage.sessionId.bind(
          { type: 'cursor-agent', sessionId: 'cursor-456' },
          { type: 'claude', sessionId: 'claude-123' },
        );

        const geminiResult = await storage.sessionId.lookup({
          target: 'gemini',
          by: { type: 'cursor-agent', sessionId: 'cursor-456' },
        });

        expect(geminiResult).toBe('gemini-123');
      });
    });
  });

  describe('OutputStorage', () => {
    describe('lookup', () => {
      test('returns null when output does not exist', async () => {
        const result = await storage.output.lookup('non-existent-id');
        expect(result).toBeNull();
      });

      test('returns full output record when all fields exist', async () => {
        const id = await storage.output.put({
          stdout: 'hello world',
          stderr: 'error message',
          fileContent: 'file data',
          statusCode: 0,
        });

        const result = await storage.output.lookup(id);

        expect(result).toEqual({
          stdout: 'hello world',
          stderr: 'error message',
          fileContent: 'file data',
          statusCode: 0,
        });
      });

      test('returns output record with optional fields as undefined', async () => {
        const id = await storage.output.put({
          stdout: 'hello world',
        });

        const result = await storage.output.lookup(id);

        expect(result).toEqual({
          stdout: 'hello world',
          stderr: undefined,
          fileContent: undefined,
          statusCode: undefined,
        });
      });
    });

    describe('put', () => {
      test('stores output and returns unique ID', async () => {
        const id1 = await storage.output.put({ stdout: 'output 1' });
        const id2 = await storage.output.put({ stdout: 'output 2' });

        expect(id1).not.toBe(id2);
        expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      });

      test('stores all optional fields', async () => {
        const id = await storage.output.put({
          stdout: 'stdout',
          stderr: 'stderr',
          fileContent: 'content',
          statusCode: 1,
        });

        const row = db.query(`SELECT * FROM outputs WHERE id = ?`).get(id) as Record<
          string,
          unknown
        >;

        expect(row.stdout).toBe('stdout');
        expect(row.stderr).toBe('stderr');
        expect(row.file_content).toBe('content');
        expect(row.status_code).toBe(1);
      });

      test('stores null for undefined optional fields', async () => {
        const id = await storage.output.put({
          stdout: 'stdout only',
        });

        const row = db.query(`SELECT * FROM outputs WHERE id = ?`).get(id) as Record<
          string,
          unknown
        >;

        expect(row.stdout).toBe('stdout only');
        expect(row.stderr).toBeNull();
        expect(row.file_content).toBeNull();
        expect(row.status_code).toBeNull();
      });
    });
  });
});
