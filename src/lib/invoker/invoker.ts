import type { AgentSessionId, AgentType, OutputId, OutputRecord, Storage } from '@lib/storage';
import type { AgentInvoker } from '@lib/invoker/types';
import { createDefaultDeps, type FileReader, type InvokerDeps } from '@lib/invoker/dependency';

type AgentJsonOutput = {
  session_id: string;
  result: string;
};

type GeminiJsonOutput = {
  session_id: string;
  response: string;
};

export function createAgentInvoker(
  storage: Storage,
  deps: InvokerDeps = createDefaultDeps(),
): AgentInvoker {
  return {
    claude: createClaudeInvoker(storage, deps),
    'cursor-agent': createCursorAgentInvoker(storage, deps),
    gemini: createGeminiInvoker(storage, deps),
  };
}

function overridePrompt(prompt: string, outputFilepath: string): string {
  return `# Prompt:
${prompt}

# Output:
- **Write only the agent's response to the specified file: ${outputFilepath}**
- **Do not print anything else to stdout.**
`;
}

async function writeOutput(
  outputStorage: Storage['output'],
  readFile: FileReader,
  output: { stdout: string; stderr: string; statusCode: number; filepath: string },
): Promise<OutputId> {
  const record: OutputRecord = {
    stdout: output.stdout,
    stderr: output.stderr,
    statusCode: output.statusCode,
  };

  const content = await readFile(output.filepath);
  if (content) {
    record.fileContent = content;
  }

  return outputStorage.put(record);
}

function createClaudeInvoker(storage: Storage, deps: InvokerDeps): AgentInvoker['claude'] {
  return async (options) => {
    const existingSessionId = await storage.sessionId.lookup({
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

    using tempFile = deps.createTempFile();
    args.push('--print', overridePrompt(options.prompt, tempFile.path));

    const { data, stderr, exitCode } = await deps.runCommand<AgentJsonOutput>('claude', args);

    await storage.sessionId.bind(
      { type: 'claude', sessionId: data.session_id },
      options.by as AgentSessionId<Exclude<AgentType, 'claude'>>,
    );

    return writeOutput(storage.output, deps.readFile, {
      stdout: data.result,
      stderr,
      statusCode: exitCode,
      filepath: tempFile.path,
    });
  };
}

function createCursorAgentInvoker(
  storage: Storage,
  deps: InvokerDeps,
): AgentInvoker['cursor-agent'] {
  return async (options) => {
    const existingSessionId = await storage.sessionId.lookup({
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

    using tempFile = deps.createTempFile();
    args.push('--print', overridePrompt(options.prompt, tempFile.path));

    const { data, stderr, exitCode } = await deps.runCommand<AgentJsonOutput>('cursor-agent', args);

    await storage.sessionId.bind(
      { type: 'cursor-agent', sessionId: data.session_id },
      options.by as AgentSessionId<Exclude<AgentType, 'cursor-agent'>>,
    );

    return writeOutput(storage.output, deps.readFile, {
      stdout: data.result,
      stderr,
      statusCode: exitCode,
      filepath: tempFile.path,
    });
  };
}

function createGeminiInvoker(storage: Storage, deps: InvokerDeps): AgentInvoker['gemini'] {
  return async (options) => {
    const existingSessionId = await storage.sessionId.lookup({
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

    using tempFile = deps.createTempFile();
    args.push('--prompt', overridePrompt(options.prompt, tempFile.path));

    const { data, stderr, exitCode } = await deps.runCommand<GeminiJsonOutput>('gemini', args);

    await storage.sessionId.bind(
      { type: 'gemini', sessionId: data.session_id },
      options.by as AgentSessionId<Exclude<AgentType, 'gemini'>>,
    );

    return writeOutput(storage.output, deps.readFile, {
      stdout: data.response,
      stderr,
      statusCode: exitCode,
      filepath: tempFile.path,
    });
  };
}
