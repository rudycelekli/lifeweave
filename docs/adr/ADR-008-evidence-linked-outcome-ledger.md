# ADR-008: Evidence-linked outcome ledger

- **Status**: implemented local alpha
- **Date**: 2026-10-13
- **Deciders**:
- **Tags**: outcomes, measurement, attribution

## Context

A handled suggestion, saved plan, self-reported action and measured result are different events. Counting them as achieved goals would create false progress and unreliable feedback.

## Decision

Link existing local drafts to an optional captured baseline, explicit user completion report, and an explicitly selected later source measurement. Preserve draft, reported and measured statuses. Compare only distinct, ordered measurements under the same declared metric definition. Keep causal attribution unknown. Quiet hours and delivery accounting apply to proactive presentation; opening a ledger is an explicit read and does not consume that budget. Source revocation removes dependent baselines, reports and drafts from exports and durable state.

## Consequences

### Positive
- Progress is supported by separate source evidence.
- The ledger can support later usefulness and oversight evaluation.

### Negative
- A later measurement does not establish that an assistant suggestion caused a result.
- Outcome learning and competitive superiority require independent evaluation.

### Neutral
- No external action executor, neural training or automatic KPI increment is introduced.

## Links

- [ADR-003](ADR-003-consent-before-observation.md)
- [ADR-004](ADR-004-process-lifetime-proactivity.md)
- [ADR-007](ADR-007-shared-context-with-explicit-identity.md)
- Graph registration is unavailable; the canonical record is this file.
