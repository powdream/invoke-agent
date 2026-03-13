import { Command } from '@cliffy/command';
import { createStorage } from '@cmd/shared/storage';
import { createDefaultDeps } from '@lib/invoker/dependency';
import { overridePrompt } from '@lib/invoker';
import type { AgentType } from '@lib/storage';

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

    const history = await storage.threads.getThreadHistory(responder);
    if (history.length === 0) {
      console.error(`Error: No history found for responder ${responder.type}:${responder.sessionId}`);
      process.exit(1);
    }

    const latestTurn = history[history.length - 1];
    const latestThreadId = latestTurn.id;

    const existingSummary = await storage.threads.getSummary(responder);
    if (existingSummary && existingSummary.lastThreadId === latestThreadId) {
      console.log(existingSummary.summary);
      return;
    }

    // Generate new summary
    console.error('Generating summary...');
    
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
    await deps.runCommand('gemini', ['--output-format', 'json', '--yolo', '--prompt', overridePrompt(promptText, tempFile.path)]);

    const summaryText = (await deps.readFile(tempFile.path)) || '';

    if (!summaryText.trim()) {
      console.error('Generated summary is empty.');
      process.exit(1);
    }

    await storage.threads.saveSummary({
      responder,
      summary: summaryText.trim(),
      lastThreadId: latestThreadId,
    });

    console.log(summaryText.trim());
  });
