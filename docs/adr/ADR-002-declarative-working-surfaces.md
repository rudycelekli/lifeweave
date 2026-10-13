# ADR-002: Declarative working surfaces

- **Status**: implemented locally
- **Date**: 2026-10-13
- **Deciders**:
- **Tags**: UI, schema, security

## Context

Proactive interfaces need useful controls while observations and future model outputs remain untrusted. Executable HTML/JSX in the same environment as private state and credentials would widen authority.

## Decision

Use validated SurfaceFrames with text, metric, checklist, timeline, trend and calculator blocks. Calculators use finite bounded arithmetic expressions with depth/node/input limits, explicit variable references and no `eval`. Render text through DOM text nodes. Hosts may replace renderers for known types; schema changes require review. External action declarations never execute in the default renderer.

## Consequences

### Positive
- Live working scenarios are portable across DOM, Web Component and React hosts.
- Unknown executable blocks and malicious fields fail validation.

### Negative
- Arbitrary rich generated tools require a future isolated sandbox and separate qualification.

### Neutral
- Scenario values are hypothetical; only separate source observations change measured progress.

## Links

- [ADR-001](ADR-001-independent-proactive-kernel.md)
- `packages/core/src/proactive-planning/domain/` and `packages/ui/src/` implement this decision.
