# ADR-006: Open local edition with premium connections and enterprise services

- **Status**: accepted product boundary; services planned
- **Date**: 2026-10-13
- **Deciders**:
- **Tags**: distribution, commercial, open-source

## Context

The user explicitly requested public open source for personal/desktop/local functionality, optional personal premium connections and an enterprise business. Hosted/mobile distribution must not make the local edition unusable.

## Decision

License original code Apache-2.0. Keep the goal engine, renderer, local worker, local storage, exports and custom connector API open without subscription checks. Monetization may come from optional maintained connections and enterprise managed integrations, administration, telemetry and support. No paid entitlement or billing is implemented in this alpha. Native/mobile and signed release artifacts need their own acceptance.

## Consequences

### Positive
- Users can inspect, run and extend the local foundation and retain their own data.

### Negative
- A commercial advantage must come from verified integration reliability and service value, not a locked local core.

### Neutral
- Provider rights, exact pricing and service terms remain undecided; source licensing does not authorize reselling a provider service.

## Links

- [Commercial model](../COMMERCIAL-MODEL.md)
- [ADR-005](ADR-005-separated-workspaces.md)
- LICENSE, public package manifests and the dependency-free local start implement the local boundary.
