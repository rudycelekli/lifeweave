# ADR-003: Consent before observation

- **Status**: implemented local boundary
- **Date**: 2026-10-13
- **Deciders**:
- **Tags**: privacy, connectors, authority

## Context

Email, health and communications can contain sensitive data and adversarial instructions. A connector's presence, a model's claim or an old ambition cannot grant access or authorize an action.

## Decision

Validate shape, tenant, source connection, scope, consent time and freshness before ingesting or using an observation. Raw mail/events stay unconfirmed signals. Credentials are refused in core connection records and remain host-owned. The local UI requires explicit import consent. Revocation deletes source observations and dependent drafts; health-scope reduction purges its local measurements. All external execution is absent from this alpha.

## Consequences

### Positive
- Invalid, revoked and foreign evidence cannot create surfaces.
- Historical ambitions remain candidates until locally adopted.

### Negative
- Live OAuth, credential vaults, pagination and provider acceptance still require implementation and trials.

### Neutral
- Local JSON storage is plaintext under the user's OS boundary; encryption remains a hosted/production gate.

## Links

- [ADR-001](ADR-001-independent-proactive-kernel.md)
- [ADR-005](ADR-005-separated-workspaces.md)
- Core action policy, provider mock tests and server consent/revocation contracts are the implementation evidence.
