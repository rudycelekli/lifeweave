import { validateState } from '../../state.mjs';
import { assertValid, stableHash } from '../../shared/validation.mjs';
import { DAY, HOUR, inQuietHours, localParts, nowDate } from '../../shared/time.mjs';
import { OBSERVATION_POLICIES } from '../../action-policy/domain/capabilities.mjs';
import { observationDecision } from '../../action-policy/application/evaluate-consent.mjs';
import { observationFingerprint } from '../../observations/domain/observation.mjs';
import { validateSurface } from '../domain/surface.mjs';
import { projectContextCorrections } from '../../shared-context/application/corrections.mjs';

export const RULES = Object.freeze([
  { id: 'overdue-commitment', kind: 'mail.commitment', description: 'An explicitly structured, incomplete commitment is overdue.' },
  { id: 'focus-opportunity', kind: 'calendar.availability', description: 'An explicitly confirmed free slot of at least 30 minutes begins within 24 hours.' },
  { id: 'sleep-reflection', kind: 'health.sleep', description: 'Three consented daily records fall below the user-chosen sleep target. Planning only.' },
  { id: 'relationship-catchup', kind: 'relationship.contact', description: 'An explicit last-contact timestamp exceeds the user interval or the 14-day fixture default.' },
  { id: 'metric-checkin', kind: 'metric.update', description: 'A current measured metric is below the user-defined goal threshold.' }
].map(Object.freeze));

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function surface(state, goal, ruleId, evidence, now, detail) {
  const evidenceRefs = evidence.map((item) => item.id).sort();
  const evidenceExpiry = Math.min(...evidence.map((item) => Date.parse(item.occurredAt) + OBSERVATION_POLICIES[item.kind].maxAgeMs));
  const consentExpiry = Math.min(...evidence.map((item) => {
    const connection = state.connections.find((entry) => entry.id === item.connectorId);
    return connection?.expiresAt ? Date.parse(connection.expiresAt) : Infinity;
  }));
  const expiresAt = new Date(Math.min(now.getTime() + DAY, evidenceExpiry, consentExpiry, detail.expiresAt || Infinity)).toISOString();
  const result = { version: 1, id: `sf-${stableHash({ tenantId: evidence[0].tenantId, goalId: goal.id, ruleId, evidenceRefs })}`,
    goalId: goal.id, dimension: goal.dimension, title: detail.title, reason: detail.reason,
    priority: clamp(detail.priority, 0, 100), confidence: detail.confidence, evidenceRefs,
    createdAt: now.toISOString(), expiresAt, status: 'active', ruleId, sourceKind: evidence[0].kind,
    blocks: detail.blocks, actions: detail.actions };
  assertValid(validateSurface(result));
  return result;
}
function localAction(id, label, intent, observationId) {
  return { id, label, kind: 'local', payload: { intent, ...(observationId ? { observationId } : {}) } };
}
const compare = (a, b) => b.priority - a.priority || b.confidence - a.confidence || a.id.localeCompare(b.id);

// Internal generation is independent from attention policy, and external narratives
// are never parsed for instructions, capability requests, or goal activation.
export function buildCandidates(state, now) {
  const suppressed = [], eligible = [], fingerprints = new Set();
  const sorted = [...state.observations].sort((a, b) => a.id.localeCompare(b.id));
  for (const observation of sorted) {
    const decision = observationDecision(state, observation, now);
    if (!decision.allowed) { suppressed.push({ id: observation.id, evidenceRefs: [observation.id], reason: decision.reason }); continue; }
    const fingerprint = observationFingerprint(observation);
    if (fingerprints.has(fingerprint)) { suppressed.push({ id: observation.id, evidenceRefs: [observation.id], reason: 'duplicate-observation' }); continue; }
    fingerprints.add(fingerprint);
    eligible.push(projectContextCorrections(state,observation,now));
    if (['mail.message', 'calendar.event'].includes(observation.kind)) suppressed.push({ id: observation.id, evidenceRefs: [observation.id], reason: 'unconfirmed-signal' });
  }
  const candidates = [];
  for (const goal of state.goals) {
    if (goal.status !== 'active') { suppressed.push({ id: goal.id, goalId: goal.id, reason: goal.status === 'candidate' ? 'candidate-goal' : 'paused-goal', evidenceRefs: [] }); continue; }
    const relevant = eligible.filter((item) => item.goalIds.includes(goal.id));
    const startCount = candidates.length;
    const commitments = relevant.filter((item) => item.kind === 'mail.commitment' && item.data?.completed === false && item.data?.dueAt && Date.parse(item.data.dueAt) < now.getTime())
      .sort((a, b) => Date.parse(a.data.dueAt) - Date.parse(b.data.dueAt));
    if (commitments.length) {
      const days = Math.floor((now.getTime() - Date.parse(commitments[0].data.dueAt)) / DAY);
      candidates.push(surface(state, goal, 'overdue-commitment', commitments, now, {
        title: 'Close an overdue commitment', priority: goal.priority + 15 + Math.min(days, 10), confidence: 0.96,
        reason: `${commitments.length} explicitly recorded ${commitments.length === 1 ? 'commitment is' : 'commitments are'} past due and incomplete for “${goal.title}”.`,
        blocks: [ { type: 'metric', label: 'Overdue commitments', value: commitments.length, unit: 'commitments' },
          { type: 'timeline', items: commitments.slice(0, 5).map((item) => ({ at: item.data.dueAt, label: item.summary.slice(0, 500) })) },
          { type: 'checklist', items: [ { id: 'review', text: 'Review the source and choose the next step.', done: false }, { id: 'prepare', text: 'Prepare a reply or renegotiate the due date.', done: false } ] } ],
        actions: [localAction('review', 'Review commitment', 'open-evidence', commitments[0].id), localAction('draft', 'Prepare a reply', 'draft-reply', commitments[0].id)]
      }));
    }
    const slots = relevant.filter((item) => item.kind === 'calendar.availability' && item.data?.available === true
      && item.data.startsAt && item.data.endsAt && Date.parse(item.data.startsAt) < now.getTime() + DAY
      && Date.parse(item.data.endsAt) - Math.max(now.getTime(), Date.parse(item.data.startsAt)) >= 30 * 60000)
      .sort((a, b) => Date.parse(a.data.startsAt) - Date.parse(b.data.startsAt));
    if (slots.length) {
      const slot = slots[0], startsAt = new Date(Math.max(now.getTime(), Date.parse(slot.data.startsAt))).toISOString();
      const minutes = Math.floor((Date.parse(slot.data.endsAt) - Date.parse(startsAt)) / 60000);
      candidates.push(surface(state, goal, 'focus-opportunity', [slot], now, {
        title: 'Use a clear window for focused progress', priority: goal.priority + 5, confidence: 0.92, expiresAt: Date.parse(slot.data.endsAt),
        reason: `A confirmed ${minutes}-minute window is available within the next 24 hours for “${goal.title}”.`,
        blocks: [ { type: 'metric', label: 'Available focus time', value: minutes, unit: 'minutes' },
          { type: 'calculator', id: 'focus-scenario', label: 'Explore your focus session',
            inputs: [{ id: 'focusMinutes', label: 'Focused work minutes', value: Math.min(25, minutes), min: 5, max: minutes, step: 5, unit: 'minutes' }],
            outputs: [{ id: 'remainingMinutes', label: 'Window remaining after focused work', unit: 'minutes', expression: { op: 'subtract', args: [minutes, { var: 'focusMinutes' }] } }] },
          { type: 'timeline', items: [{ at: startsAt, label: 'Confirmed available window starts' }, { at: slot.data.endsAt, label: 'Available window ends' }] },
          { type: 'checklist', items: [{ id: 'outcome', text: 'Choose one achievable outcome for this window.', done: false }] } ],
        actions: [localAction('plan', 'Plan this focus session', 'plan-focus', slot.id)]
      }));
    }
    if (goal.metric?.key === 'sleepHours' && goal.metric.direction === 'increase') {
      const daysSeen = new Set();
      const sleep = relevant.filter((item) => item.kind === 'health.sleep' && typeof item.metrics?.sleepHours === 'number')
        .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).filter((item) => {
          const day = localParts(new Date(item.occurredAt), state.preferences.timezone).day;
          if (daysSeen.has(day)) return false;
          daysSeen.add(day); return true;
        }).slice(0, 3).reverse();
      if (sleep.length === 3) {
        const average = sleep.reduce((sum, item) => sum + item.metrics.sleepHours, 0) / sleep.length;
        if (average < goal.metric.target - 0.5) candidates.push(surface(state, goal, 'sleep-reflection', sleep, now, {
          title: 'Reflect on your recent sleep', priority: goal.priority + 3, confidence: 0.85,
          reason: `Three recent consented daily records average ${average.toFixed(1)} hours, below your chosen ${goal.metric.target}-hour target. This is a planning prompt.`,
          blocks: [ { type: 'metric', label: 'Three-record average', value: Math.round(average * 10) / 10, target: goal.metric.target, unit: 'hours' },
            { type: 'trend', label: 'Recorded sleep', unit: 'hours', points: sleep.map((item) => ({ at: item.occurredAt, value: item.metrics.sleepHours })) },
            { type: 'text', text: 'Review what affected your routine and choose a small adjustment if useful. These records do not establish a medical finding.' } ],
          actions: [localAction('reflect', 'Plan a routine adjustment', 'reflect-sleep')]
        }));
      }
    }
    const contacts = relevant.filter((item) => item.kind === 'relationship.contact' && item.data?.lastContactAt
      && Date.parse(item.data.lastContactAt) <= now.getTime()).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
    if (contacts.length) {
      const contact = contacts[0], days = Math.floor((now.getTime() - Date.parse(contact.data.lastContactAt)) / DAY);
      const interval = goal.metric?.key === 'contactIntervalDays' && goal.metric.target > 0 ? goal.metric.target : 14;
      if (days >= interval) candidates.push(surface(state, goal, 'relationship-catchup', [contact], now, {
        title: 'Make time for a meaningful catchup', priority: goal.priority + 2, confidence: 0.9,
        reason: `The explicitly recorded last contact was ${days} days ago, beyond your ${interval}-day planning interval for “${goal.title}”.`,
        blocks: [ { type: 'metric', label: 'Days since recorded contact', value: days, target: interval, unit: 'days' },
          { type: 'text', text: `Consider a time to reconnect${contact.data.personLabel ? ` with ${contact.data.personLabel}` : ''}. Missing communications cannot be inferred from this record.` } ],
        actions: [localAction('catchup', 'Plan a catchup', 'draft-catchup', contact.id)]
      }));
    }
    const updates = relevant.filter((item) => item.kind === 'metric.update' && goal.metric && typeof item.metrics?.[goal.metric.key] === 'number')
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
    if (updates.length && goal.metric) {
      const latest = updates[0], value = latest.metrics[goal.metric.key];
      const behind = goal.metric.direction === 'increase' ? value < goal.metric.target : value > goal.metric.target;
      if (behind) candidates.push(surface(state, goal, 'metric-checkin', [latest], now, {
        title: 'Choose the next step toward your target', priority: goal.priority, confidence: 0.95,
        reason: `The latest explicit ${goal.metric.key} measurement is ${value} ${goal.metric.unit}; your chosen target is ${goal.metric.target}.`,
        blocks: [ { type: 'metric', label: goal.metric.key, value, target: goal.metric.target, unit: goal.metric.unit }, { type: 'text', text: `Choose one next step for “${goal.title}”. A measured gap does not establish the cause or predict success.` } ],
        actions: [localAction('step', 'Plan a next step', 'plan-step', latest.id)]
      }));
    }
    if (candidates.length === startCount) suppressed.push({ id: goal.id, goalId: goal.id, evidenceRefs: relevant.map((item) => item.id), reason: relevant.length ? 'insufficient-actionable-data' : 'no-current-evidence' });
  }
  return { candidates: candidates.sort(compare), suppressed, eligible };
}

export function evaluate(state, { now, mode = 'live' } = {}) {
  assertValid(validateState(state));
  if (!['live', 'replay'].includes(mode)) throw new TypeError('mode must be live or replay');
  const at = nowDate(now);
  const { candidates, suppressed, eligible } = buildCandidates(state, at);
  const today = localParts(at, state.preferences.timezone).day;
  const feedback = state.feedback.filter((item) => Date.parse(item.at) <= at.getTime());
  const deliveries = (state.deliveries || []).filter((item) => Date.parse(item.at) <= at.getTime());
  const deliveredToday = new Set(deliveries.filter((item) => localParts(new Date(item.at), state.preferences.timezone).day === today).map((item) => item.surfaceId));
  const usedToday = new Set([...deliveredToday, ...feedback.filter((item) => localParts(new Date(item.at), state.preferences.timezone).day === today).map((item) => item.surfaceId)]);
  let remaining = Math.max(0, state.preferences.dailySurfaceBudget - usedToday.size);
  const quiet = inQuietHours(at, state.preferences);
  const surfaces = [];
  for (const candidate of candidates) {
    const latestFeedback = feedback.filter((item) => item.surfaceId === candidate.id).sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
    let reason;
    if (latestFeedback && (latestFeedback.kind !== 'snooze' || Date.parse(latestFeedback.until) > at.getTime())) reason = latestFeedback.kind === 'snooze' ? 'snoozed' : `feedback-${latestFeedback.kind}`;
    else if (mode === 'live' && quiet) reason = 'quiet-hours';
    else if (mode === 'live' && !deliveredToday.has(candidate.id) && deliveries.some((item) => item.surfaceId === candidate.id
      && !(latestFeedback?.kind === 'snooze' && Date.parse(latestFeedback.until) <= at.getTime() && Date.parse(item.at) < Date.parse(latestFeedback.until)))) reason = 'already-delivered';
    else if (mode === 'live' && !deliveredToday.has(candidate.id) && remaining <= 0) reason = 'attention-budget';
    if (reason) suppressed.push({ id: candidate.id, goalId: candidate.goalId, ruleId: candidate.ruleId, evidenceRefs: candidate.evidenceRefs, reason });
    else { surfaces.push(candidate); if (mode === 'live' && !deliveredToday.has(candidate.id)) remaining -= 1; }
  }
  return { surfaces, suppressed, stats: { mode, evaluatedAt: at.toISOString(), tenantId: state.tenantId,
    goals: state.goals.length, activeGoals: state.goals.filter((item) => item.status === 'active').length,
    observations: state.observations.length, eligibleObservations: eligible.length, candidates: candidates.length,
    published: surfaces.length, suppressed: suppressed.length, quietHours: quiet,
    dailySurfaceBudget: state.preferences.dailySurfaceBudget, deliveredToday: deliveredToday.size,
    dailyBudgetRemaining: Math.max(0, remaining), costUsd: null, planner: 'deterministic-rules-v1' } };
}
