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
    let existingSessionId: string | null = null;
    if (!options.newSession) {
      existingSessionId = await storage.threads.lookupLastSessionId(options.by, 'claude');
    }

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

    const outputId = await writeOutput(storage.output, deps.readFile, {
      stdout: data.result,
      stderr,
      statusCode: exitCode,
      filepath: tempFile.path,
    });

    await storage.threads.append({
      requester: options.by,
      responder: { type: 'claude', sessionId: data.session_id },
      prompt: options.prompt,
      outputId,
    });

    return outputId;
  };
}

function createCursorAgentInvoker(
  storage: Storage,
  deps: InvokerDeps,
): AgentInvoker['cursor-agent'] {
  return async (options) => {
    let existingSessionId: string | null = null;
    if (!options.newSession) {
      existingSessionId = await storage.threads.lookupLastSessionId(options.by, 'cursor-agent');
    }

    const args = ['--output-format', 'json', '--force'];

    if (options.model) {
      args.push('--model', options.model);
    }

    if (existingSessionId) {
      args.push('--resume', existingSessionId);
    }

    using tempFile = deps.createTempFile();
    args.push('--print', overridePrompt(options.prompt, tempFile.path));

    const { data, stderr, exitCode } = await deps.runCommand<AgentJsonOutput>('cursor-agent', args);

    const outputId = await writeOutput(storage.output, deps.readFile, {
      stdout: data.result,
      stderr,
      statusCode: exitCode,
      filepath: tempFile.path,
    });

    await storage.threads.append({
      requester: options.by,
      responder: { type: 'cursor-agent', sessionId: data.session_id },
      prompt: options.prompt,
      outputId,
    });

    return outputId;
  };
}

function createGeminiInvoker(storage: Storage, deps: InvokerDeps): AgentInvoker['gemini'] {
  return async (options) => {
    let existingSessionId: string | null = null;
    if (!options.newSession) {
      existingSessionId = await storage.threads.lookupLastSessionId(options.by, 'gemini');
    }

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

    const outputId = await writeOutput(storage.output, deps.readFile, {
      stdout: data.response,
      stderr,
      statusCode: exitCode,
      filepath: tempFile.path,
    });

    await storage.threads.append({
      requester: options.by,
      responder: { type: 'gemini', sessionId: data.session_id },
      prompt: options.prompt,
      outputId,
    });

    return outputId;
  };
}
