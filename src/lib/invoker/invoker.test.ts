import { Database } from 'bun:sqlite';
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { SqliteStorage } from '@lib/storage';
import { createAgentInvoker } from '@lib/invoker/invoker';
import type {
  CommandResult,
  CommandRunner,
  FileReader,
  InvokerDeps,
  TempFileFactory,
} from '@lib/invoker/dependency';

describe('createAgentInvoker', () => {
  let db: Database;
  let storage: SqliteStorage;
  let mockDeps: InvokerDeps;
  let capturedCommands: { cmd: string; args: string[] }[];
  let tempFileContent: string | null;
  let disposed: boolean;

  beforeEach(() => {
    db = new Database(':memory:');
    storage = new SqliteStorage(db);
    capturedCommands = [];
    tempFileContent = null;
    disposed = false;

    const mockRunCommand: CommandRunner = async <T>(cmd: string, args: string[]) => {
      capturedCommands.push({ cmd, args });

      if (cmd === 'gemini') {
        return {
          data: { session_id: `${cmd}-session-123`, response: `${cmd} response` } as T,
          stderr: '',
          exitCode: 0,
        };
      }

      return {
        data: { session_id: `${cmd}-session-123`, result: `${cmd} result` } as T,
        stderr: '',
        exitCode: 0,
      };
    };

    const mockCreateTempFile: TempFileFactory = () => ({
      path: '/tmp/mock-temp-file.txt',
      [Symbol.dispose]: () => {
        disposed = true;
      },
    });

    const mockReadFile: FileReader = async () => tempFileContent;

    mockDeps = {
      runCommand: mockRunCommand,
      createTempFile: mockCreateTempFile,
      readFile: mockReadFile,
    };
  });

  afterEach(() => {
    storage.close();
  });

  describe('claude invoker', () => {
    test('calls claude CLI with correct base args', async () => {
      const invoker = createAgentInvoker(storage, mockDeps);

      await invoker.claude({
        by: { type: 'gemini', sessionId: 'gemini-456' },
        prompt: 'hello',
      });

      expect(capturedCommands).toHaveLength(1);
      expect(capturedCommands[0].cmd).toBe('claude');
      expect(capturedCommands[0].args).toContain('--output-format');
      expect(capturedCommands[0].args).toContain('json');
      expect(capturedCommands[0].args).toContain('--dangerously-skip-permissions');
      expect(capturedCommands[0].args).toContain('--print');
    });

    test('includes --model when specified', async () => {
      const invoker = createAgentInvoker(storage, mockDeps);

      await invoker.claude({
        by: { type: 'gemini', sessionId: 'gemini-456' },
        prompt: 'hello',
        model: 'claude-sonnet-4',
      });

      expect(capturedCommands[0].args).toContain('--model');
      expect(capturedCommands[0].args).toContain('claude-sonnet-4');
    });

    test('includes --resume when session exists', async () => {
      await storage.sessionId.bind(
        { type: 'claude', sessionId: 'existing-claude-session' },
        { type: 'gemini', sessionId: 'gemini-456' },
      );

      const invoker = createAgentInvoker(storage, mockDeps);

      await invoker.claude({
        by: { type: 'gemini', sessionId: 'gemini-456' },
        prompt: 'hello',
      });

      expect(capturedCommands[0].args).toContain('--resume');
      expect(capturedCommands[0].args).toContain('existing-claude-session');
    });

    test('binds new session ID after invocation', async () => {
      const invoker = createAgentInvoker(storage, mockDeps);

      await invoker.claude({
        by: { type: 'gemini', sessionId: 'gemini-456' },
        prompt: 'hello',
      });

      const boundSession = await storage.sessionId.lookup({
        target: 'claude',
        by: { type: 'gemini', sessionId: 'gemini-456' },
      });

      expect(boundSession).toBe('claude-session-123');
    });

    test('stores output record', async () => {
      tempFileContent = 'file content from agent';
      const invoker = createAgentInvoker(storage, mockDeps);

      const outputId = await invoker.claude({
        by: { type: 'gemini', sessionId: 'gemini-456' },
        prompt: 'hello',
      });

      const output = await storage.output.lookup(outputId);
      expect(output).not.toBeNull();
      expect(output!.stdout).toBe('claude result');
      expect(output!.fileContent).toBe('file content from agent');
      expect(output!.statusCode).toBe(0);
    });

    test('disposes temp file after invocation', async () => {
      const invoker = createAgentInvoker(storage, mockDeps);

      await invoker.claude({
        by: { type: 'gemini', sessionId: 'gemini-456' },
        prompt: 'hello',
      });

      expect(disposed).toBe(true);
    });
  });

  describe('cursor-agent invoker', () => {
    test('calls cursor-agent CLI with correct base args', async () => {
      const invoker = createAgentInvoker(storage, mockDeps);

      await invoker['cursor-agent']({
        by: { type: 'claude', sessionId: 'claude-456' },
        prompt: 'hello',
      });

      expect(capturedCommands[0].cmd).toBe('cursor-agent');
      expect(capturedCommands[0].args).toContain('--force');
      expect(capturedCommands[0].args).toContain('--trust');
      expect(capturedCommands[0].args).toContain('--print');
    });

    test('includes --model when specified', async () => {
      const invoker = createAgentInvoker(storage, mockDeps);

      await invoker['cursor-agent']({
        by: { type: 'claude', sessionId: 'claude-456' },
        prompt: 'hello',
        model: 'gpt-4',
      });

      expect(capturedCommands[0].args).toContain('--model');
      expect(capturedCommands[0].args).toContain('gpt-4');
    });

    test('includes --resume when session exists', async () => {
      await storage.sessionId.bind(
        { type: 'cursor-agent', sessionId: 'existing-cursor-session' },
        { type: 'claude', sessionId: 'claude-456' },
      );

      const invoker = createAgentInvoker(storage, mockDeps);

      await invoker['cursor-agent']({
        by: { type: 'claude', sessionId: 'claude-456' },
        prompt: 'hello',
      });

      expect(capturedCommands[0].args).toContain('--resume');
      expect(capturedCommands[0].args).toContain('existing-cursor-session');
    });

    test('binds new session ID after invocation', async () => {
      const invoker = createAgentInvoker(storage, mockDeps);

      await invoker['cursor-agent']({
        by: { type: 'claude', sessionId: 'claude-456' },
        prompt: 'hello',
      });

      const boundSession = await storage.sessionId.lookup({
        target: 'cursor-agent',
        by: { type: 'claude', sessionId: 'claude-456' },
      });

      expect(boundSession).toBe('cursor-agent-session-123');
    });
  });

  describe('gemini invoker', () => {
    test('calls gemini CLI with correct base args', async () => {
      const invoker = createAgentInvoker(storage, mockDeps);

      await invoker.gemini({
        by: { type: 'claude', sessionId: 'claude-456' },
        prompt: 'hello',
      });

      expect(capturedCommands[0].cmd).toBe('gemini');
      expect(capturedCommands[0].args).toContain('--yolo');
      expect(capturedCommands[0].args).toContain('--prompt');
    });

    test('includes --model when specified', async () => {
      const invoker = createAgentInvoker(storage, mockDeps);

      await invoker.gemini({
        by: { type: 'claude', sessionId: 'claude-456' },
        prompt: 'hello',
        model: 'gemini-2.0-flash',
      });

      expect(capturedCommands[0].args).toContain('--model');
      expect(capturedCommands[0].args).toContain('gemini-2.0-flash');
    });

    test('includes --resume when session exists', async () => {
      await storage.sessionId.bind(
        { type: 'gemini', sessionId: 'existing-gemini-session' },
        { type: 'claude', sessionId: 'claude-456' },
      );

      const invoker = createAgentInvoker(storage, mockDeps);

      await invoker.gemini({
        by: { type: 'claude', sessionId: 'claude-456' },
        prompt: 'hello',
      });

      expect(capturedCommands[0].args).toContain('--resume');
      expect(capturedCommands[0].args).toContain('existing-gemini-session');
    });

    test('uses response field instead of result', async () => {
      const invoker = createAgentInvoker(storage, mockDeps);

      const outputId = await invoker.gemini({
        by: { type: 'claude', sessionId: 'claude-456' },
        prompt: 'hello',
      });

      const output = await storage.output.lookup(outputId);
      expect(output!.stdout).toBe('gemini response');
    });

    test('binds new session ID after invocation', async () => {
      const invoker = createAgentInvoker(storage, mockDeps);

      await invoker.gemini({
        by: { type: 'claude', sessionId: 'claude-456' },
        prompt: 'hello',
      });

      const boundSession = await storage.sessionId.lookup({
        target: 'gemini',
        by: { type: 'claude', sessionId: 'claude-456' },
      });

      expect(boundSession).toBe('gemini-session-123');
    });
  });

  describe('error handling', () => {
    test('stores non-zero exit code', async () => {
      const errorDeps: InvokerDeps = {
        ...mockDeps,
        runCommand: async <T>() =>
          ({
            data: { session_id: 'session-123', result: 'error output' } as T,
            stderr: 'something went wrong',
            exitCode: 1,
          }) as CommandResult<T>,
      };

      const invoker = createAgentInvoker(storage, errorDeps);

      const outputId = await invoker.claude({
        by: { type: 'gemini', sessionId: 'gemini-456' },
        prompt: 'hello',
      });

      const output = await storage.output.lookup(outputId);
      expect(output!.statusCode).toBe(1);
      expect(output!.stderr).toBe('something went wrong');
    });

    test('handles missing file content gracefully', async () => {
      tempFileContent = null;
      const invoker = createAgentInvoker(storage, mockDeps);

      const outputId = await invoker.claude({
        by: { type: 'gemini', sessionId: 'gemini-456' },
        prompt: 'hello',
      });

      const output = await storage.output.lookup(outputId);
      expect(output!.fileContent).toBeUndefined();
    });
  });
});
