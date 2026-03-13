import type { AgentSessionId, AgentType, OutputId } from '@lib/storage';

export type AgentInvoker = {
  [T in AgentType]: (options: {
    by: AgentSessionId;
    model?: string;
    prompt: string;
    newSession?: boolean;
  }) => Promise<OutputId>;
};
