import type {
  AgentInvoker,
  AgentSessionId,
  AgentType,
  ApiClient,
  OutputId,
  OutputRecord,
} from '@lib/api/client';
import { createDefaultDeps, type FileReader, type InvokerDeps } from '@lib/api/invoker/dependency';

type Client = Pick<ApiClient, 'sessionId' | 'output'>;

type AgentJsonOutput = {
  session_id: string;
  result: string;
};

type GeminiJsonOutput = {
  session_id: string;
  response: string;
};

export function createAgentInvoker(
  client: Client,
  deps: InvokerDeps = createDefaultDeps(),
): AgentInvoker {
  return {
    claude: createClaudeInvoker(client, deps),
    'cursor-agent': createCursorAgentInvoker(client, deps),
    gemini: createGeminiInvoker(client, deps),
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
  outputClient: Client['output'],
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

  return outputClient.put(record);
}

function createClaudeInvoker(client: Client, deps: InvokerDeps): AgentInvoker['claude'] {
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

    using tempFile = deps.createTempFile();
    args.push('--print', overridePrompt(options.prompt, tempFile.path));

    const { data, stderr, exitCode } = await deps.runCommand<AgentJsonOutput>('claude', args);

    await client.sessionId.bind(
      { type: 'claude', sessionId: data.session_id },
      options.by as AgentSessionId<Exclude<AgentType, 'claude'>>,
    );

    return writeOutput(client.output, deps.readFile, {
      stdout: data.result,
      stderr,
      statusCode: exitCode,
      filepath: tempFile.path,
    });
  };
}

function createCursorAgentInvoker(client: Client, deps: InvokerDeps): AgentInvoker['cursor-agent'] {
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

    using tempFile = deps.createTempFile();
    args.push('--print', overridePrompt(options.prompt, tempFile.path));

    const { data, stderr, exitCode } = await deps.runCommand<AgentJsonOutput>('cursor-agent', args);

    await client.sessionId.bind(
      { type: 'cursor-agent', sessionId: data.session_id },
      options.by as AgentSessionId<Exclude<AgentType, 'cursor-agent'>>,
    );

    return writeOutput(client.output, deps.readFile, {
      stdout: data.result,
      stderr,
      statusCode: exitCode,
      filepath: tempFile.path,
    });
  };
}

function createGeminiInvoker(client: Client, deps: InvokerDeps): AgentInvoker['gemini'] {
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

    using tempFile = deps.createTempFile();
    args.push('--prompt', overridePrompt(options.prompt, tempFile.path));

    const { data, stderr, exitCode } = await deps.runCommand<GeminiJsonOutput>('gemini', args);

    await client.sessionId.bind(
      { type: 'gemini', sessionId: data.session_id },
      options.by as AgentSessionId<Exclude<AgentType, 'gemini'>>,
    );

    return writeOutput(client.output, deps.readFile, {
      stdout: data.response,
      stderr,
      statusCode: exitCode,
      filepath: tempFile.path,
    });
  };
}
