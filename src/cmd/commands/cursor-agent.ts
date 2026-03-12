import { Command } from '@cliffy/command';
import { createStorage } from '@cmd/shared/storage';
import { createAgentInvoker } from '@lib/invoker';

export const cursorAgentCommand = new Command()
  .description('Invoke Cursor Agent')
  .option('--claude-session-id <sessionId:string>', 'Claude session ID to bind')
  .option('--gemini-session-id <sessionId:string>', 'Gemini session ID to bind')
  .option('--model <model:string>', 'Model to use')
  .option('--json', 'Output result as JSON')
  .arguments('<prompt:string>')
  .action(async (options, prompt) => {
    const bySessionId = options.claudeSessionId ?? options.geminiSessionId;
    const byType = options.claudeSessionId ? 'claude' : 'gemini';

    if (!bySessionId) {
      console.error('Error: Either --claude-session-id or --gemini-session-id is required');
      process.exit(1);
    }

    using storage = createStorage(options);
    const invoker = createAgentInvoker(storage);

    const outputId = await invoker['cursor-agent']({
      by: { type: byType, sessionId: bySessionId },
      model: options.model,
      prompt,
    });

    if (options.json) {
      console.log(JSON.stringify({ outputId }));
    } else {
      console.log(outputId);
    }
  });
