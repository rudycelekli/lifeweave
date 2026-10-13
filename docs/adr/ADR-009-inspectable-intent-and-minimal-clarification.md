# ADR-009: Inspectable intent and minimal clarification

- **Status**: implemented local alpha
- **Date**: 2026-10-13
- **Deciders**:
- **Tags**: intent, clarification, attention

## Context

A person should be able to request a useful interface without navigating every tool. Silent guesses about goals or time constraints would undermine that interface.

## Decision

Compile a bounded set of explicit English focus requests into a visible goal-and-constraint brief and a declarative working surface. Confirmed available time stays source-backed. User time constraints change scenario bounds and defaults, never measurements or authority. Unsupported or conflicting constraints produce one clarification question. Missing-context gaps are factual, source-scoped and deduplicated; a user may pause or snooze their exact missing-fact question. Applying a typed correction requires a fresh gap check and explicit confirmation. Requests cannot activate candidates, grant permissions or call models automatically.

## Consequences

### Positive
- The user can inspect what was understood and use a small, relevant interface.
- Clarification is limited to information that changes the decision.

### Negative
- The deterministic compiler supports a limited grammar and intent family.
- It does not establish general language understanding or live account acceptance.

### Neutral
- SDK and host policy continue to own evidence, freshness and action checks.

## Links

- [ADR-002](ADR-002-declarative-working-surfaces.md)
- [ADR-004](ADR-004-process-lifetime-proactivity.md)
- [ADR-007](ADR-007-shared-context-with-explicit-identity.md)
- Graph registration is unavailable; the canonical record is this file.
