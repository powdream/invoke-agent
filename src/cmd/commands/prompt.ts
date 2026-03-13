import { Command } from '@cliffy/command';
import { createStorage } from '@cmd/shared/storage';
import { createAgentInvoker } from '@lib/invoker';
import type { AgentType } from '@lib/storage';

export const promptCommand = new Command()
  .description('Invoke an AI agent')
  .option('--to <agentType:string>', 'Target agent to invoke (claude|cursor-agent|gemini)', { required: true })
  .option('--from <agentType:string>', 'Requester agent type (claude|cursor-agent|gemini)', { required: true })
  .option('--from-session-id <sessionId:string>', 'Requester session ID', { required: true })
  .option('--new', 'Start a new session instead of resuming the previous one')
  .option('--model <model:string>', 'Model to use')
  .option('--json', 'Output result as JSON')
  .arguments('<prompt:string>')
  .action(async (options, prompt) => {
    const validAgents = ['claude', 'cursor-agent', 'gemini'];
    
    if (!validAgents.includes(options.to)) {
      console.error(`Error: Invalid target agent '${options.to}'. Valid options are: ${validAgents.join(', ')}`);
      process.exit(1);
    }
    
    if (!validAgents.includes(options.from)) {
      console.error(`Error: Invalid requester agent '${options.from}'. Valid options are: ${validAgents.join(', ')}`);
      process.exit(1);
    }

    using storage = createStorage(options);
    const invoker = createAgentInvoker(storage);

    const targetType = options.to as AgentType;
    const invokerFn = invoker[targetType];

    const outputId = await invokerFn({
      by: { type: options.from as AgentType, sessionId: options.fromSessionId },
      model: options.model,
      prompt,
      newSession: options.new,
    });

    if (options.json) {
      console.log(JSON.stringify({ outputId }));
    } else {
      console.log(outputId);
    }
  });
