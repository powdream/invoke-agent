import { Command } from '@cliffy/command';
import { createStorage } from '@cmd/shared/storage';
import type { AgentType } from '@lib/storage';

export const listCommand = new Command()
  .description('List responder sessions mapped to a requester session')
  .option('--from <agentType:string>', 'Requester agent type (claude|cursor-agent|gemini)', { required: true })
  .option('--from-session-id <sessionId:string>', 'Requester session ID', { required: true })
  .action(async (options) => {
    using storage = createStorage(options);
    
    const requester = {
      type: options.from as AgentType,
      sessionId: options.fromSessionId,
    };

    const sessions = await storage.threads.listByRequester(requester);

    if (sessions.length === 0) {
      console.log('No sessions found.');
      return;
    }

    console.log(`Found ${sessions.length} session(s) for requester ${requester.type}:${requester.sessionId}:\n`);

    for (const session of sessions) {
      const summary = await storage.threads.getSummary(session);
      const summaryText = summary ? (summary.summary.substring(0, 100) + (summary.summary.length > 100 ? '...' : '')) : '(No summary available, run "summary" command)';
      
      console.log(`- Responder: ${session.type}`);
      console.log(`  Session ID: ${session.sessionId}`);
      console.log(`  Summary: ${summaryText}`);
      console.log();
    }
  });
