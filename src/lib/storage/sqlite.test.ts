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
      expect(tableNames).toContain('session_threads');
      expect(tableNames).toContain('session_summaries');
      expect(tableNames).toContain('outputs');
    });

    test('sets schema version on fresh database', () => {
      const result = db.query(`SELECT value FROM schema_meta WHERE key = 'version'`).get() as {
        value: string;
      };

      expect(result.value).toBe('3');
    });

    test('drops old tables when schema version differs', () => {
      // Simulate older version schema
      db.run(`CREATE TABLE session_bindings (id INTEGER)`);
      db.run(`UPDATE schema_meta SET value = '2' WHERE key = 'version'`);

      new SqliteStorage(db);

      const tables = db
        .query(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
        .all() as { name: string }[];
      
      const tableNames = tables.map((t) => t.name);
      expect(tableNames).not.toContain('session_bindings');
      expect(tableNames).toContain('session_threads');
    });
  });

  describe('ThreadStorage', () => {
    describe('lookupLastSessionId and append', () => {
      test('returns null when no history exists', async () => {
        const result = await storage.threads.lookupLastSessionId(
          { type: 'claude', sessionId: 'req-1' },
          'gemini'
        );
        expect(result).toBeNull();
      });

      test('returns last session id after append', async () => {
        await storage.threads.append({
          requester: { type: 'claude', sessionId: 'req-1' },
          responder: { type: 'gemini', sessionId: 'res-1' },
          prompt: 'hello',
          outputId: 'out-1',
        });

        const result = await storage.threads.lookupLastSessionId(
          { type: 'claude', sessionId: 'req-1' },
          'gemini'
        );
        expect(result).toBe('res-1');
      });
    });

    describe('listByRequester', () => {
      test('returns distinct responder sessions', async () => {
        await storage.threads.append({
          requester: { type: 'claude', sessionId: 'req-1' },
          responder: { type: 'gemini', sessionId: 'res-1' },
          prompt: '1',
          outputId: 'out-1',
        });
        await storage.threads.append({
          requester: { type: 'claude', sessionId: 'req-1' },
          responder: { type: 'gemini', sessionId: 'res-1' },
          prompt: '2',
          outputId: 'out-2',
        });
        await storage.threads.append({
          requester: { type: 'claude', sessionId: 'req-1' },
          responder: { type: 'cursor-agent', sessionId: 'res-2' },
          prompt: '3',
          outputId: 'out-3',
        });

        const results = await storage.threads.listByRequester({ type: 'claude', sessionId: 'req-1' });
        expect(results).toHaveLength(2);
        expect(results).toContainEqual({ type: 'gemini', sessionId: 'res-1' });
        expect(results).toContainEqual({ type: 'cursor-agent', sessionId: 'res-2' });
      });
    });

    describe('getThreadHistory', () => {
      test('returns history in order', async () => {
        await storage.threads.append({
          requester: { type: 'claude', sessionId: 'req-1' },
          responder: { type: 'gemini', sessionId: 'res-1' },
          prompt: 'msg 1',
          outputId: 'out-1',
        });
        await storage.threads.append({
          requester: { type: 'claude', sessionId: 'req-1' },
          responder: { type: 'gemini', sessionId: 'res-1' },
          prompt: 'msg 2',
          outputId: 'out-2',
        });

        const history = await storage.threads.getThreadHistory({ type: 'gemini', sessionId: 'res-1' });
        expect(history).toHaveLength(2);
        expect(history[0].prompt).toBe('msg 1');
        expect(history[1].prompt).toBe('msg 2');
      });
    });

    describe('summaries', () => {
      test('saves and retrieves summary', async () => {
        await storage.threads.saveSummary({
          responder: { type: 'gemini', sessionId: 'res-1' },
          summary: 'A short summary',
          lastThreadId: 42,
        });

        const summary = await storage.threads.getSummary({ type: 'gemini', sessionId: 'res-1' });
        expect(summary).not.toBeNull();
        expect(summary?.summary).toBe('A short summary');
        expect(summary?.lastThreadId).toBe(42);
      });

      test('updates existing summary on conflict', async () => {
        await storage.threads.saveSummary({
          responder: { type: 'gemini', sessionId: 'res-1' },
          summary: 'A short summary',
          lastThreadId: 42,
        });
        await storage.threads.saveSummary({
          responder: { type: 'gemini', sessionId: 'res-1' },
          summary: 'Updated summary',
          lastThreadId: 43,
        });

        const summary = await storage.threads.getSummary({ type: 'gemini', sessionId: 'res-1' });
        expect(summary?.summary).toBe('Updated summary');
        expect(summary?.lastThreadId).toBe(43);
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
    });
  });
});