# ADR-007: Shared context with explicit identity

- **Status**: implemented local alpha
- **Date**: 2026-10-13
- **Deciders**:
- **Tags**: context, provenance, identity

## Context

Capabilities need consistent goal, person, project and commitment identities. An inferred name match or a reused private source can silently cross purpose or workspace boundaries.

## Decision

Build a pure shared-context projection from the current tenant's active goals and currently eligible evidence. People and projects have explicit user-authored IDs and goal associations; observations link them through declared entity IDs. Similar labels never cause automatic merging. Source facts and user-confirmed missing-field corrections remain separate records. Corrections retain source identity and affect derived views only while the original source and goal remain valid. Revocation removes derived links and corrections while preserving independently authored context.

## Consequences

### Positive
- Every tool can reuse inspectable goal and identity context.
- Raw source records remain recoverable and separate from user confirmations.

### Negative
- Identity reconciliation requires an explicit local choice.
- This is structured context, not vector retrieval or model training.

### Neutral
- Existing version-1 states remain compatible through optional bounded extensions.

## Links

- [ADR-001](ADR-001-independent-proactive-kernel.md)
- [ADR-003](ADR-003-consent-before-observation.md)
- [ADR-005](ADR-005-separated-workspaces.md)
- Graph registration is unavailable; the canonical record is this file.
