import { spawn } from 'bun';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync } from 'node:fs';

export type CommandResult<T> = {
  data: T;
  stderr: string;
  exitCode: number;
};

export type CommandRunner = <T>(cmd: string, args: string[]) => Promise<CommandResult<T>>;

export type TempFile = {
  path: string;
  [Symbol.dispose]: () => void;
};

export type TempFileFactory = () => TempFile;

export type FileReader = (filepath: string) => Promise<string | null>;

export type InvokerDeps = {
  runCommand: CommandRunner;
  createTempFile: TempFileFactory;
  readFile: FileReader;
};

export function createDefaultDeps(): InvokerDeps {
  const runCommand: CommandRunner = async <T>(cmd: string, args: string[]) => {
    const proc = spawn([cmd, ...args], {
      stdin: null,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);

    const exitCode = await proc.exited;

    let data: T;
    try {
      data = JSON.parse(stdout) as T;
    } catch (e) {
      // Handle the case where the agent crashes or returns non-JSON output (e.g. login prompt)
      data = {
        session_id: '',
        result: stdout,
        response: stdout, 
      } as unknown as T;
      
      const parseErrorMsg = `Failed to parse agent output as JSON. Raw output:\n${stdout}\nStderr:\n${stderr}`;
      return { data, stderr: stderr || parseErrorMsg, exitCode: exitCode || 1 };
    }

    return { data, stderr, exitCode };
  };

  const createTempFile: TempFileFactory = () => {
    const path = join(tmpdir(), `temp-${randomUUID()}.txt`);

    return {
      path,
      [Symbol.dispose]: () => {
        try {
          unlinkSync(path);
        } catch {
          // Ignore errors - file may not exist
        }
      },
    };
  };

  const readFile: FileReader = async (filepath: string) => {
    try {
      const content = await Bun.file(filepath).text();
      return content || null;
    } catch {
      return null;
    }
  };

  return { runCommand, createTempFile, readFile };
}
