import { spawn } from 'bun';
import type {
  AgentInvoker,
  AgentSessionId,
  AgentType,
  ApiClient,
  OutputId,
  OutputRecord,
} from '@lib/api/client';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync } from 'node:fs';
type Client = Pick<ApiClient, 'sessionId' | 'output'>;

type AgentJsonOutput = {
  session_id: string;
  result: string;
};

type GeminiJsonOutput = {
  session_id: string;
  response: string;
};

type CommandResult<T> = {
  data: T;
  stderr: string;
  exitCode: number;
};

export function createAgentInvoker(client: Client): AgentInvoker {
  return {
    claude: createClaudeInvoker(client),
    'cursor-agent': createCursorAgentInvoker(client),
    gemini: createGeminiInvoker(client),
  };
}

async function runCommand<T>(cmd: string, args: string[]): Promise<CommandResult<T>> {
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
  const data = JSON.parse(stdout) as T;

  return {
    data,
    stderr,
    exitCode,
  };
}

const createTempFile = () => {
  const path = join(tmpdir(), `temp-${randomUUID()}.txt`);

  return {
    path,
    [Symbol.dispose]: () => {
      try {
        unlinkSync(path);
      } catch {
        // Ignore errors - file may not exist
      }
      console.log('임시 파일이 정리되었습니다.');
    },
  };
};

function overridePrompt(prompt: string, outputFilepath: string): string {
  return `# Prompt:
${prompt}

# Output:
- **Write only the agent's response to the specified file: ${outputFilepath}**
- **Do not print anything else to stdout.**
`;
}

async function writeOutput(
  outputClient: Client['output'],
  output: { stdout: string; stderr: string; statusCode: number; filepath: string },
): Promise<OutputId> {
  const record: OutputRecord = {
    stdout: output.stdout,
    stderr: output.stderr,
    statusCode: output.statusCode,
  };

  try {
    const content = await Bun.file(output.filepath).text();
    if (content) {
      record.fileContent = content;
    }
  } catch {
    // File not found or unreadable - skip fileContent
  }

  return outputClient.put(record);
}

function createClaudeInvoker(client: Client): AgentInvoker['claude'] {
  return async (options) => {
    const existingSessionId = await client.sessionId.lookup({
      target: 'claude',
      by: options.by,
    });

    const args = ['--output-format', 'json', '--dangerously-skip-permissions'];

    if (options.model) {
      args.push('--model', options.model);
    }

    if (existingSessionId) {
      args.push('--resume', existingSessionId);
    }

    using tempFile = createTempFile();
    args.push('--print', overridePrompt(options.prompt, tempFile.path));

    const { data, stderr, exitCode } = await runCommand<AgentJsonOutput>('claude', args);

    await client.sessionId.bind(
      { type: 'claude', sessionId: data.session_id },
      options.by as AgentSessionId<Exclude<AgentType, 'claude'>>,
    );

    return writeOutput(client.output, {
      stdout: data.result,
      stderr,
      statusCode: exitCode,
      filepath: tempFile.path,
    });
  };
}

function createCursorAgentInvoker(client: Client): AgentInvoker['cursor-agent'] {
  return async (options) => {
    const existingSessionId = await client.sessionId.lookup({
      target: 'cursor-agent',
      by: options.by,
    });

    const args = ['--output-format', 'json', '--force', '--trust'];

    if (options.model) {
      args.push('--model', options.model);
    }

    if (existingSessionId) {
      args.push('--resume', existingSessionId);
    }

    using tempFile = createTempFile();
    args.push('--print', overridePrompt(options.prompt, tempFile.path));

    const { data, stderr, exitCode } = await runCommand<AgentJsonOutput>('cursor-agent', args);

    await client.sessionId.bind(
      { type: 'cursor-agent', sessionId: data.session_id },
      options.by as AgentSessionId<Exclude<AgentType, 'cursor-agent'>>,
    );

    return writeOutput(client.output, {
      stdout: data.result,
      stderr,
      statusCode: exitCode,
      filepath: tempFile.path,
    });
  };
}

function createGeminiInvoker(client: Client): AgentInvoker['gemini'] {
  return async (options) => {
    const existingSessionId = await client.sessionId.lookup({
      target: 'gemini',
      by: options.by,
    });

    const args = ['--output-format', 'json', '--yolo'];

    if (options.model) {
      args.push('--model', options.model);
    }

    if (existingSessionId) {
      args.push('--resume', existingSessionId);
    }

    using tempFile = createTempFile();
    args.push('--prompt', overridePrompt(options.prompt, tempFile.path));

    const { data, stderr, exitCode } = await runCommand<GeminiJsonOutput>('gemini', args);

    await client.sessionId.bind(
      { type: 'gemini', sessionId: data.session_id },
      options.by as AgentSessionId<Exclude<AgentType, 'gemini'>>,
    );

    return writeOutput(client.output, {
      stdout: data.response,
      stderr,
      statusCode: exitCode,
      filepath: tempFile.path,
    });
  };
}
