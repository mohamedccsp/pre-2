import { checkPromptInjection } from '@/lib/maestro/validator';
import { logAuditEntry, hashForAudit } from '@/lib/maestro/audit-logger';
import { verifyEnvelope } from './message-bus';
import { researcher } from './researcher';
import { analyst } from './analyst';
import { advisor } from './advisor';
import type { Agent, AgentInput, AgentOutput } from '@/lib/types/agent';

/** Registry of available agents */
const agents: Record<string, Agent> = {
  researcher,
  analyst,
  advisor,
};

/**
 * Execute an agent through the orchestrator with full MAESTRO controls
 * This is the single entry point for all agent calls (MAESTRO L3, L5)
 * @param agentName - Name of the agent to execute
 * @param input - Agent input with query and optional context
 * @returns Agent output with audit ID
 */
export async function executeAgent(
  agentName: string,
  input: AgentInput
): Promise<AgentOutput> {
  // L3: Verify agent exists and is registered
  const agent = agents[agentName];
  if (!agent) {
    throw new Error(`Unknown agent: ${agentName}. Available: ${Object.keys(agents).join(', ')}`);
  }

  // L7: Verify agent identity token when present in routed messages
  if (input.context?._identityToken) {
    const valid = verifyEnvelope(
      input.context._messageFrom as string,
      input.context._payloadHash as string,
      input.context._identityToken as string
    );
    if (!valid) {
      throw new Error(`MAESTRO L7: Identity verification failed for message to ${agentName}`);
    }
  }

  // L1: Check for prompt injection
  const injectionCheck = checkPromptInjection(input.query);
  if (!injectionCheck.safe) {
    // L5: Log blocked attempt
    await logAuditEntry({
      agentName,
      action: 'blocked_injection',
      inputHash: hashForAudit(input.query),
      outputHash: '',
      durationMs: 0,
      success: false,
      error: injectionCheck.reason,
    });
    throw new Error(injectionCheck.reason || 'Query blocked by security filter');
  }

  // Execute agent with timing
  const startTime = Date.now();
  let output: AgentOutput;

  try {
    output = await agent.execute(input);
    const durationMs = Date.now() - startTime;

    // L5: Log successful execution
    const auditEntry = await logAuditEntry({
      agentName,
      action: 'execute',
      inputHash: hashForAudit(input.query),
      outputHash: hashForAudit(output.result),
      durationMs,
      success: true,
    });

    output.auditId = auditEntry.id;
    return output;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // L5: Log failed execution
    await logAuditEntry({
      agentName,
      action: 'execute',
      inputHash: hashForAudit(input.query),
      outputHash: '',
      durationMs,
      success: false,
      error: errorMessage,
    });

    throw error;
  }
}

/**
 * Get list of available agent names
 * @returns Array of registered agent names
 */
export function getAvailableAgents(): string[] {
  return Object.keys(agents);
}
