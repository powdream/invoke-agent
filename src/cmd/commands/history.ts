import { Command } from '@cliffy/command';
import { createStorage } from '@cmd/shared/storage';
import type { AgentType } from '@lib/storage';

export const historyCommand = new Command()
  .description('Print the full chronological history for a responder session')
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
      console.log(`No history found for responder ${responder.type}:${responder.sessionId}`);
      return;
    }

    for (const turn of history) {
      console.log(`\n==================================================`);
      console.log(`[User Prompt]`);
      console.log(`==================================================`);
      console.log(turn.prompt);
      
      const output = await storage.output.lookup(turn.outputId);
      console.log(`\n==================================================`);
      console.log(`[Agent Response] (${responder.type})`);
      console.log(`==================================================`);
      if (output?.stdout) {
        console.log(output.stdout);
      } else {
        console.log(`(No output found or stdout was empty)`);
      }
    }
    console.log(`\n==================================================`);
  });
