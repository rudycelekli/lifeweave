# ADR-005: Separate personal and business workspaces

- **Status**: implemented single-user boundary
- **Date**: 2026-10-13
- **Deciders**:
- **Tags**: DDD, tenancy, SMB

## Context

The product starts with people but must support small and midsize businesses. Personal ambitions, health and communications must not be converted into management telemetry by default.

## Decision

Use isolated synthetic, personal and business state, with a distinct business tenant identifier. Reuse core goals, measurements and surfaces, allowing domain-specific dimensions. Reject cross-tenant observations. Capture workspace identity across asynchronous UI requests and serialized writes. Treat future organization membership, owner roles, purpose-scoped sharing and multi-user encrypted storage as additional gates.

## Consequences

### Positive
- Business workflows can use the portable foundation without sharing private personal state.

### Negative
- This local single-user implementation does not establish hosted ACLs or enterprise multi-user readiness.

### Neutral
- Future management, website and marketing packs declare their own schemas, integrations and independently authorized side effects.

## Links

- [ADR-001](ADR-001-independent-proactive-kernel.md)
- [ADR-003](ADR-003-consent-before-observation.md)
- Server tenant-boundary/concurrency tests and workspace UI implement this local decision.
