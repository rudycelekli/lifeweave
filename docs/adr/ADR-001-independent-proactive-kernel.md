# ADR-001: Independent goal and evidence kernel

- **Status**: implemented locally
- **Date**: 2026-10-13
- **Deciders**:
- **Tags**: domain, portability, proactivity

## Context

The reviewed projects cover generative UI, agent runtimes and distribution, but do not together establish a goal-linked whole-life assistant. A wholesale merge would couple identity, permissions, model providers and distribution to multiple incompatible hosts.

## Decision

Implement a browser-safe, dependency-free core with bounded contexts for goals, observations, proactive planning and action policy. Keep UI, credentials, storage and provider runtime adapters separate. Active goal choice and explicit observation mapping are required. Fixed rule heuristics are not calibrated outcome predictions.

## Consequences

### Positive
- Personal, business, desktop and renderer hosts can reuse the same deterministic contracts.
- Policy can be tested independently from models and connectors.

### Negative
- Seven upstream products cannot be treated as already integrated; adapters need qualification.

### Neutral
- Optional models and semantic retrieval remain future host capabilities; this core performs neither training nor embeddings.

## Links

- [Source research](../research/upstream-analysis.md)
- [ADR-002](ADR-002-declarative-working-surfaces.md)
- `packages/core/src/index.mjs` and four context entry points implement this decision.
