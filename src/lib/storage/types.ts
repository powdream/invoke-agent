export type AgentType = 'gemini' | 'cursor-agent' | 'claude';

export type AgentSessionId<T extends AgentType = AgentType> = {
  type: T;
  sessionId: string;
};

export interface ThreadTurn {
  id: number;
  requesterType: AgentType;
  requesterSessionId: string;
  responderType: AgentType;
  responderSessionId: string;
  prompt: string;
  outputId: string;
  createdAt: number;
  output?: OutputRecord;
}

export interface ThreadSummary {
  responderType: AgentType;
  responderSessionId: string;
  summary: string;
  lastThreadId: number;
  updatedAt: number;
}

export interface ThreadStorage {
  lookupLastSessionId(requester: AgentSessionId, targetAgentType: AgentType): Promise<string | null>;
  append(params: {
    requester: AgentSessionId;
    responder: AgentSessionId;
    prompt: string;
    outputId: string;
  }): Promise<void>;
  listByRequester(requester: AgentSessionId): Promise<AgentSessionId[]>;
  getThreadHistory(responder: AgentSessionId): Promise<ThreadTurn[]>;
  getSummary(responder: AgentSessionId): Promise<ThreadSummary | null>;
  saveSummary(params: { responder: AgentSessionId; summary: string; lastThreadId: number }): Promise<void>;
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

export interface Storage {
  threads: ThreadStorage;
  output: OutputStorage;
  close(): void;
}
