import { Command } from '@cliffy/command';
import { createStorage } from '@cmd/shared/storage';
import { createDefaultDeps } from '@lib/invoker/dependency';
import { overridePrompt } from '@lib/invoker';
import type { AgentSessionId, AgentType, Storage } from '@lib/storage';

export async function getOrGenerateSummary(storage: Storage, responder: AgentSessionId): Promise<string> {
  const history = await storage.threads.getThreadHistory(responder);
  if (history.length === 0) {
    throw new Error(`No history found for responder ${responder.type}:${responder.sessionId}`);
  }

  const latestTurn = history[history.length - 1];
  const latestThreadId = latestTurn.id;

  const existingSummary = await storage.threads.getSummary(responder);
  if (existingSummary && existingSummary.lastThreadId === latestThreadId) {
    return existingSummary.summary;
  }

  // Generate new summary
  const deps = createDefaultDeps();
  let conversationText = '';
  
  for (const turn of history) {
    const output = await storage.output.lookup(turn.outputId);
    conversationText += `User: ${turn.prompt}\n\n`;
    if (output?.stdout) {
      conversationText += `Agent: ${output.stdout}\n\n`;
    }
  }

  const promptText = `Please summarize the following conversation in one paragraph. Keep it concise.\n\n${conversationText}`;

  using tempFile = deps.createTempFile();
  const { exitCode } = await deps.runCommand('gemini', ['--output-format', 'json', '--yolo', '--prompt', overridePrompt(promptText, tempFile.path)]);

  if (exitCode !== 0) {
    throw new Error('Failed to generate summary.');
  }

  const summaryText = (await deps.readFile(tempFile.path)) || '';

  if (!summaryText.trim()) {
    throw new Error('Generated summary is empty.');
  }

  const finalSummary = summaryText.trim();

  await storage.threads.saveSummary({
    responder,
    summary: finalSummary,
    lastThreadId: latestThreadId,
  });

  return finalSummary;
}

export const summaryCommand = new Command()
  .description('Get or generate a summary for a specific responder session')
  .option('--to <agentType:string>', 'Responder agent type', { required: true })
  .option('--to-session-id <sessionId:string>', 'Responder session ID', { required: true })
  .action(async (options) => {
    using storage = createStorage(options);
    
    const responder = {
      type: options.to as AgentType,
      sessionId: options.toSessionId,
    };

    try {
      console.error('Checking summary...');
      const summary = await getOrGenerateSummary(storage, responder);
      console.log(summary);
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      process.exit(1);
    }
  });
