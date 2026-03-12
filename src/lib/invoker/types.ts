import type { AgentSessionId, AgentType, OutputId } from '@lib/storage';

export type AgentInvoker = {
  [T in AgentType]: (options: {
    by: AgentSessionId<Exclude<AgentType, T>>;
    model?: string;
    prompt: string;
  }) => Promise<OutputId>;
};
