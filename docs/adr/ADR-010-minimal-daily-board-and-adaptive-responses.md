# ADR-010: Minimal daily board and adaptive responses

- **Status**: implemented local alpha
- **Date**: 2026-10-13
- **Deciders**:
- **Tags**: daily-board, attention, response-routing, UX

## Context

Eight permanent navigation sections and a fixed queue/tool layout front-load complexity. A person needs a useful next move, a quiet default, and the right representation for their request. Hidden suggestions must not spend attention or gain action rights.

## Decision

Compose a pure, bounded daily board from current policy-filtered surfaces. Present at most three moves and one primary next step. Keep the working tool closed until requested, and put existing workspace capabilities behind a compact accessible disclosure. Record deliveries only for mounted board moves. Quiet hours, consent, evidence freshness and budget remain outside response generation.

Route a bounded set of explicit requests to a brief, short answer, progress table, comparison, or confirmed-window focus scenario. Unknown facts remain unknown. Responses use strict inert data; tables and text do not grant execution authority. Source/tenant-bound previews are revalidated before opening a related working surface. Requests never mint availability, measurements or goal progress.

Preserve active typing through unrelated fresh evidence updates. Relevant source revocation or changed grounding invalidates private views even during editing. Keep all prior tools accessible on demand; this is a navigation simplification, not deletion of capabilities.

## Consequences

### Positive
- One home gives a small, relevant starting point.
- Explicit requests use the smallest useful representation.
- Hidden candidates do not silently consume attention.

### Negative
- The deterministic response grammar is bounded, not general conversational intelligence.
- Real usefulness and interruption burden still require prospective user evaluation.

### Neutral
- Existing SDK intents, outcomes, model preview and capability policies remain compatible.

## Links

- [ADR-002](ADR-002-declarative-working-surfaces.md)
- [ADR-004](ADR-004-process-lifetime-proactivity.md)
- [ADR-009](ADR-009-inspectable-intent-and-minimal-clarification.md)
- Graph tools remain unavailable. This file is the canonical local decision record; no graph registration is claimed.
