import type { AgentSessionId, AgentType, OutputId, OutputRecord, Storage } from '@lib/storage';
import type { AgentInvoker } from '@lib/invoker/types';
import { createDefaultDeps, type FileReader, type InvokerDeps } from '@lib/invoker/dependency';

type AnyOutput = {
  session_id: string;
  result?: string;
  response?: string;
};

type InvokerConfig = {
  command: string;
  agentType: AgentType;
  authFlag: string;
  promptFlag: string;
  getOutput: (data: AnyOutput) => string;
};

export function createAgentInvoker(
  storage: Storage,
  deps: InvokerDeps = createDefaultDeps(),
): AgentInvoker {
  return {
    claude: createInvoker(
      { command: 'claude', agentType: 'claude', authFlag: '--dangerously-skip-permissions', promptFlag: '--print', getOutput: d => d.result ?? '' },
      storage, deps,
    ),
    'cursor-agent': createInvoker(
      { command: 'cursor-agent', agentType: 'cursor-agent', authFlag: '--force', promptFlag: '--print', getOutput: d => d.result ?? '' },
      storage, deps,
    ),
    gemini: createInvoker(
      { command: 'gemini', agentType: 'gemini', authFlag: '--yolo', promptFlag: '--prompt', getOutput: d => d.response ?? '' },
      storage, deps,
    ),
  };
}

export function overridePrompt(prompt: string, outputFilepath: string): string {
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

function createInvoker(config: InvokerConfig, storage: Storage, deps: InvokerDeps) {
  return async (options: { by: AgentSessionId; model?: string; prompt: string; newSession?: boolean }): Promise<OutputId> => {
    let existingSessionId: string | null = null;
    if (!options.newSession) {
      existingSessionId = await storage.threads.lookupLastSessionId(options.by, config.agentType);
    }

    const args = ['--output-format', 'json', config.authFlag];

    if (options.model) {
      args.push('--model', options.model);
    }

    if (existingSessionId) {
      args.push('--resume', existingSessionId);
    }

    using tempFile = deps.createTempFile();
    args.push(config.promptFlag, overridePrompt(options.prompt, tempFile.path));

    const { data, stderr, exitCode } = await deps.runCommand<AnyOutput>(config.command, args);

    const outputId = await writeOutput(storage.output, deps.readFile, {
      stdout: config.getOutput(data),
      stderr,
      statusCode: exitCode,
      filepath: tempFile.path,
    });

    if (data.session_id) {
      await storage.threads.append({
        requester: options.by,
        responder: { type: config.agentType, sessionId: data.session_id },
        prompt: options.prompt,
        outputId,
      });
    }

    return outputId;
  };
}
