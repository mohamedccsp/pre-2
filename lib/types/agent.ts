/** Agent interface — each agent module exports this */
export interface Agent {
  name: string;
  role: string;
  maestroLayer: number[];
  allowedTools: string[];
  execute(input: AgentInput): Promise<AgentOutput>;
}

/** Input to any agent */
export interface AgentInput {
  query: string;
  context?: Record<string, unknown>;
}

/** Output from any agent */
export interface AgentOutput {
  agentName: string;
  result: string;
  sources: string[];
  timestamp: number;
  auditId: string;
  queryType?: ResearchQueryType;
  coinIds?: string[];
}

/** Query type classification for the researcher */
export type ResearchQueryType = 'coin' | 'comparison' | 'market';

/** Classified research query with extracted metadata */
export interface ClassifiedQuery {
  type: ResearchQueryType;
  coinIds: string[];
  originalQuery: string;
}

/** Audit log entry for MAESTRO L5 */
export interface AuditEntry {
  id: string;
  agentName: string;
  action: string;
  inputHash: string;
  outputHash: string;
  timestamp: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

/** Research history item for the UI */
export interface ResearchHistoryItem {
  id: string;
  query: string;
  queryType: ResearchQueryType;
  result: string;
  sources: string[];
  timestamp: number;
  auditId: string;
}
