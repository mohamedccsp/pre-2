import { createHmac } from 'crypto';
import { logAuditEntry, hashForAudit } from '@/lib/maestro/audit-logger';
import type { AgentInput } from '@/lib/types/agent';

/** Inter-agent message record for audit trail (MAESTRO L7) */
export interface AgentMessage {
  readonly fromAgent: string;
  readonly toAgent: string;
  readonly messageType: string;
  readonly payloadHash: string;
  readonly timestamp: number;
}

/** Message type constants for the agent chain */
export const MESSAGE_TYPES = {
  RESEARCH_COMPLETE: 'research_complete',
  ANALYSIS_COMPLETE: 'analysis_complete',
  RECOMMENDATION_READY: 'recommendation_ready',
} as const;

/**
 * Sign a message envelope with the sending agent's identity key (MAESTRO L7)
 * Key is derived from AGENT_SECRET_KEY env var + agent name.
 * @param fromAgent - Name of the sending agent
 * @param payloadHash - Already-computed hash of the message payload
 * @returns HMAC hex token
 */
function signEnvelope(fromAgent: string, payloadHash: string): string {
  const secret = process.env.AGENT_SECRET_KEY || 'default-dev-key';
  return createHmac('sha256', `${secret}:${fromAgent}`)
    .update(payloadHash)
    .digest('hex');
}

/**
 * Verify a message token before the receiving agent processes it (MAESTRO L7)
 * @param fromAgent - Claimed sender agent name
 * @param payloadHash - Hash of the received payload
 * @param token - HMAC token to verify
 * @returns True if token is valid
 */
export function verifyEnvelope(fromAgent: string, payloadHash: string, token: string): boolean {
  const expected = signEnvelope(fromAgent, payloadHash);
  return expected === token;
}

/**
 * Route a message between agents with audit logging (MAESTRO L7)
 * Validates and logs the handoff, then returns an AgentInput for the receiving agent.
 * @param from - Sending agent name
 * @param to - Receiving agent name
 * @param messageType - Type of message being routed
 * @param query - Query string to pass through
 * @param payload - Data to pass as context
 * @returns AgentInput ready for the receiving agent
 */
export async function routeMessage(
  from: string,
  to: string,
  messageType: string,
  query: string,
  payload: Record<string, unknown>
): Promise<AgentInput> {
  const message: AgentMessage = {
    fromAgent: from,
    toAgent: to,
    messageType,
    payloadHash: hashForAudit(JSON.stringify(payload)),
    timestamp: Date.now(),
  };

  await logAuditEntry({
    agentName: from,
    action: `message_routed:${messageType}`,
    inputHash: hashForAudit(from + to + messageType),
    outputHash: message.payloadHash,
    durationMs: 0,
    success: true,
  });

  const identityToken = signEnvelope(from, message.payloadHash);

  return {
    query,
    context: {
      ...payload,
      _messageFrom: from,
      _messageType: messageType,
      _identityToken: identityToken,
      _payloadHash: message.payloadHash,
    },
  };
}
