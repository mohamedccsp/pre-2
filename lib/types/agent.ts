/** Agent interface — used in Phase 2+ but defined now for type consistency */
export interface AgentInput {
  query: string;
  context?: Record<string, unknown>;
}

/** Agent output structure */
export interface AgentOutput {
  agentName: string;
  result: string;
  sources: string[];
  timestamp: number;
  auditId: string;
}

/** Agent definition — each agent module exports this */
export interface Agent {
  name: string;
  role: string;
  maestroLayer: number[];
  allowedTools: string[];
  execute(input: AgentInput): Promise<AgentOutput>;
}
