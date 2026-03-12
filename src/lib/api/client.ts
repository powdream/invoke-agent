export interface ApiClient {
  sessionId: SessionIdStorage;
  output: OutputStorage;
  agentInvoker: AgentInvoker;
}

export type AgentType = 'gemini' | 'cursor-agent' | 'claude';

export type AgentSessionId<T extends AgentType> = {
  type: T;
  sessionId: string;
};

export type LookupSessionIdParams = {
  [T in AgentType]: {
    target: T;
    by: AgentSessionId<Exclude<AgentType, T>>;
  };
}[AgentType];

export interface SessionIdStorage {
  lookup(params: LookupSessionIdParams): Promise<string | null>;

  bind<T extends AgentType>(
    from: AgentSessionId<T>,
    to: AgentSessionId<Exclude<AgentType, T>>,
  ): Promise<void>;
}

export type OutputId = string;

export type OutputRecord = {
  stdout: string;
  stderr?: string;
  fileContent?: string;
  statusCode?: number;
};

export interface OutputStorage {
  lookup(outputId: OutputId): Promise<OutputRecord | null>;

  put(options: OutputRecord): Promise<OutputId>;
}

export type AgentInvoker = {
  [T in AgentType]: (options: {
    by: AgentSessionId<Exclude<AgentType, T>>;
    model?: string;
    prompt: string;
  }) => Promise<OutputId>;
};

export function createApiClient(
  sessionId: SessionIdStorage,
  output: OutputStorage,
  agentInvoker: AgentInvoker,
): ApiClient {
  return { sessionId, output, agentInvoker };
}
