import { Command } from '@cliffy/command';
import { Database } from 'bun:sqlite';
import { resolveDbPath } from '@cmd/shared/options';
import { SqliteClient } from '@lib/api/sqlite';
import { createAgentInvoker } from '@lib/api/invoker';

export const claudeCommand = new Command()
  .description('Invoke Claude AI agent')
  .option('--gemini-session-id <sessionId:string>', 'Gemini session ID to bind')
  .option('--cursor-session-id <sessionId:string>', 'Cursor Agent session ID to bind')
  .option('--model <model:string>', 'Model to use')
  .option('--json', 'Output result as JSON')
  .arguments('<prompt:string>')
  .action(async (options, prompt) => {
    const bySessionId = options.geminiSessionId ?? options.cursorSessionId;
    const byType = options.geminiSessionId ? 'gemini' : 'cursor-agent';

    if (!bySessionId) {
      console.error('Error: Either --gemini-session-id or --cursor-session-id is required');
      process.exit(1);
    }

    const dbPath = resolveDbPath(options);
    const db = new Database(dbPath);
    const storage = new SqliteClient(db);
    const invoker = createAgentInvoker(storage);

    try {
      const outputId = await invoker.claude({
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
      db.close();
    }
  });
