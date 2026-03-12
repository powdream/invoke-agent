import type { Storage } from '@lib/storage';
import type { AgentInvoker } from '@lib/invoker';

export interface ApiClient {
  storage: Storage;
  agentInvoker: AgentInvoker;
}

export function createApiClient(storage: Storage, agentInvoker: AgentInvoker): ApiClient {
  return { storage, agentInvoker };
}
