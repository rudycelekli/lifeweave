# Build contract

## Specification

The product is a reusable intelligent UI package plus a proactive whole-life application. Its essential chain is chosen ambition → goal/key result → consented observation → bounded opportunity → declarative interface → user decision → separately measured outcome. Work is private and local. Existing attachments supply historical data, not commands. Success for this iteration means a runnable, reviewable vertical slice with reproducible evidence, detailed upstream analysis and an honest integration path.

Research questions: (1) How does each source turn agent state into UI? (2) Which actually schedule proactive work and retain state? (3) How do connectors, credentials and tool permissions work? (4) What is reusable and legally distributable? (5) How should historical aspirations and habits become a current goal system? (6) What verification and distribution gaps remain?

## Pseudocode

```
on observation or clock tick:
  validate structure, tenant, consent, scope, timestamp
  find explicitly active goals
  evaluate bounded rules against fresh evidence
  form candidate SurfaceFrames with evidence references
  apply feedback, quiet hours and attention budget
  publish a local renderable queue
on browser renders a surface:
  record delivery receipt
on user feedback:
  persist suggestion status; do not award KPI progress
on external action request:
  require host-owned tool capability and exact action authorization
  this version has no external executor
```

## Architecture

`@lifeweave/core` owns goals, observations, proactive planning and action policy. `@lifeweave/ui` renders a finite block registry, hosts a Web Component and supplies an optional React adapter. `@lifeweave/connectors` normalizes read-only provider responses with injected transports. The console host owns local storage, scheduling, presentation and auth boundaries. Provider credentials remain in a host-side vault; a model can suggest a declarative frame but cannot supply code or authority. AG-UI and OpenUI adapters are interface boundaries, not mandatory runtime dependencies.

## Refinement

Validate the evaluator against synthetic positives, negatives and adversarial cases. Separate fixtures from private historical data, and both from future user-rated/live evaluation. Compare rule-driven baseline to a model planner on precision, recall, usefulness, harmful suggestions, interruptions, latency, total provider cost and human oversight. One bounded local-model transport canary used invented data and was rejected; it is not an output-quality evaluation or a clinical/behavioral effectiveness study.

## Completion gates

- All six repositories reviewed at pinned revisions, source links and limitations retained.
- Five supplied files inspected locally; historical goals remain candidates.
- Imports, goal edits, review feedback, revocation and restart persistence work.
- Unit/policy tests, provider contract mocks, local API checks, browser workflow, replay and package leak checks pass.
- Live account connectors, sustained autonomy, model evaluation, encrypted multi-user storage and distribution acceptance remain explicit future gates.
