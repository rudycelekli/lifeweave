import { OBSERVATION_POLICIES, ACTION_CAPABILITIES } from '../domain/capabilities.mjs';
import { validateState } from '../../state.mjs';
import { assertValid } from '../../shared/validation.mjs';
import { nowDate } from '../../shared/time.mjs';

export function connectionDecision(state, connectorId, scope, now) {
  const connection = state.connections.find((item) => item.id === connectorId);
  if (!connection) return { allowed: false, reason: 'missing-connection' };
  if (connection.status !== 'connected') return { allowed: false, reason: 'consent-revoked' };
  if (!connection.consentAt || Date.parse(connection.consentAt) > now.getTime()) return { allowed: false, reason: 'missing-current-consent' };
  if (connection.expiresAt && Date.parse(connection.expiresAt) <= now.getTime()) return { allowed: false, reason: 'consent-expired' };
  if (!connection.scopes.includes(scope)) return { allowed: false, reason: 'missing-scope' };
  return { allowed: true, reason: 'consented' };
}

export function observationDecision(state, observation, now) {
  if (observation.tenantId !== state.tenantId) return { allowed: false, reason: 'tenant-mismatch' };
  const policy = OBSERVATION_POLICIES[observation.kind];
  if (!policy) return { allowed: false, reason: 'unsupported-observation-kind' };
  const age = now.getTime() - Date.parse(observation.occurredAt);
  if (age < 0) return { allowed: false, reason: 'future-observation' };
  if (age >= policy.maxAgeMs) return { allowed: false, reason: 'stale-evidence' };
  return connectionDecision(state, observation.connectorId, policy.scope, now);
}

export function canUseCapability(state, connectorId, capability, { now = new Date() } = {}) {
  // This reports consent only. It never approves or executes an external action.
  assertValid(validateState(state));
  if (!ACTION_CAPABILITIES.includes(capability)) return { allowed: false, reason: 'unsupported-capability' };
  const at = nowDate(now);
  return connectionDecision(state, connectorId, capability, at);
}
