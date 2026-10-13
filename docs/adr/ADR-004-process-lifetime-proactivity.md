# ADR-004: Process lifetime proactivity and attention receipts

- **Status**: implemented locally
- **Date**: 2026-10-13
- **Deciders**:
- **Tags**: scheduling, attention, evidence

## Context

Proactivity must be real scheduling and useful silence, not an implied background promise. Evaluation, delivery and goal completion are different events.

## Decision

Run an actual one-minute evaluator while the local host is open. Re-evaluate consent, freshness, feedback, quiet hours and daily attention budget. Record UI delivery separately. Stable evidence-linked IDs prevent unchanged signals from republishing. The desktop shell owns a child backend and uses parent-death cleanup. Persist state atomically across restarts.

## Consequences

### Positive
- Reproducible local ticks and durable feedback can be inspected and tested.
- No model cost is incurred by unchanged or clock-driven baseline evaluation.

### Negative
- Closing the host stops evaluation; no always-on login service, notification transport or distributed leased worker exists yet.

### Neutral
- Distributed execution can later borrow leased-job patterns from OpenInstinct/Rakazo without inheriting their broad tool authority.

## Links

- [ADR-003](ADR-003-consent-before-observation.md)
- `apps/web/server.mjs`, core feedback/delivery logic and native shell lifecycle tests implement this decision.
