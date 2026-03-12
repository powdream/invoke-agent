import { Command } from '@cliffy/command';
import { Database } from 'bun:sqlite';
import { resolveDbPath } from '@cmd/shared/options';
import { SqliteStorage } from '@lib/storage';
import { createAgentInvoker } from '@lib/invoker';

export const geminiCommand = new Command()
  .description('Invoke Gemini AI agent')
  .option('--claude-session-id <sessionId:string>', 'Claude session ID to bind')
  .option('--cursor-session-id <sessionId:string>', 'Cursor Agent session ID to bind')
  .option('--model <model:string>', 'Model to use')
  .option('--json', 'Output result as JSON')
  .arguments('<prompt:string>')
  .action(async (options, prompt) => {
    const bySessionId = options.claudeSessionId ?? options.cursorSessionId;
    const byType = options.claudeSessionId ? 'claude' : 'cursor-agent';

    if (!bySessionId) {
      console.error('Error: Either --claude-session-id or --cursor-session-id is required');
      process.exit(1);
    }

    const dbPath = resolveDbPath(options);
    const storage = new SqliteStorage(new Database(dbPath));
    const invoker = createAgentInvoker(storage);

    try {
      const outputId = await invoker.gemini({
        by: { type: byType, sessionId: bySessionId },
        model: options.model,
        prompt,
      });

      if (options.json) {
        console.log(JSON.stringify({ outputId }));
      } else {
        console.log(outputId);
      }
    } finally {
      storage.close();
    }
  });
