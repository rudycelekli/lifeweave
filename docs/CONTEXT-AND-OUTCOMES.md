# Shared context, concise requests and measured outcomes

LifeWeave's local core connects active goals to eligible source records and explicitly authored people and projects. Every entity has its own ID; similar names never merge implicitly. Sources may link existing entities with `data.entityIds`. Personal and business workspaces keep separate state.

The compact Today request control is a deterministic English focus interpreter. It supports active-goal selection and bounded minute limits, using an existing confirmed calendar window. It asks one bounded question at a time when a goal or duration is ambiguous. Unsupported requests stay unavailable. This is not general natural-language intelligence, a scheduling authority, or a model call.

`compileIntent` returns an inspectable brief and a declarative surface. Questions carry current identities and choices. Continue with `{answer:{questionId,value}}`; after a goal answer, carry the returned `brief.goalId` if a minute question follows. The host stores an expiring preview and checks it again before acceptance or draft creation. An ongoing window's projected start can move by milliseconds; all other displayed facts, bounds, source identities and action declarations must still match. Reduced time, feedback, changed sources, revocation and expiry invalidate the preview. The console checks accepted requested views again on its 60-second refresh.

## Missing facts

Shared Context lists current consent/source/measurement gaps and missing commitment fields. Source and consent gaps route to Evidence or Connections. They cannot grant access automatically. A due date or completion flag can be proposed, reviewed and explicitly confirmed. Confirmation creates a separate user annotation bound to the original source revision; it never overwrites imported evidence, invents metrics or activates a goal. Pause and snooze preferences apply to one exact question. Changed underlying facts can create a new question.

## Outcomes

Saving a local draft captures its evidence references, eligible baseline if one exists, declared metric semantics and explicit context IDs. The Outcomes page records the user's usefulness, effort and note. A report can explicitly link a distinct later source measurement for the same goal. Marking a suggestion handled or reporting effort does not create a measurement.

The ledger distinguishes `draft`, `reported` and `measured`. A delta requires comparable metric key, declared unit, direction and target. Changed declarations, missing baselines or incompatible records produce no delta. Counts deduplicate source comparisons. Units are goal-declared; imported observations do not independently establish their unit accuracy. Every receipt keeps causal attribution `not-established`. This is an evidence trail, not proof that the assistant caused progress.

Revoking a source removes its raw evidence and dependent draft baselines, context snapshots, outcome links and correction receipts from memory, disk and export. Independently user-authored people and projects remain. Source freshness can withhold an old entry without asserting that its user report was false.

## API and evaluation contract

Core APIs: `buildSharedContext`, `upsertContextEntity`, `effectiveObservation`, `recordContextCorrection`, `capturePlanBaseline`, `recordPlanOutcome`, `buildOutcomeLedger`, `pruneContextData`, `compileIntent`, `detectContextGaps`, `resolveContextGap`. Inputs, state extensions and outputs have public TypeScript declarations. Version-1 states remain compatible through bounded optional fields.

Host endpoints include `/api/context`, `/api/context-gaps`, `/api/outcomes`, `/api/intent`, `/api/intent/review`, `/api/context-entities`, `/api/context-gaps/resolve`, `/api/context-gaps/confirm` and `/api/context-gaps/feedback`. Writes require the exact loopback origin and session CSRF token. Preview IDs are host- and workspace-bound; request/resolve operations are inert. Drafts and reports are local records. No route adds external execution authority.

Regression fixtures cover original-source preservation, unsupported and contradictory durations, sequential clarification, stale question/source rejection, real-clock preview review, exact declared draft grounding, metric drift, overflow, distinct later measurements, forged tenant/source links, bounded input shapes, restart persistence and revocation. DOM tests exercise explicit review and late-response cancellation. Independent review uses isolated invented state. Browser checks use synthetic data. These validate software behavior; longitudinal usefulness, interruption burden, human oversight cost and goal improvement need a prospective user study with frozen baselines and an independently reviewed comparison group.

The implementation learns from [Loops AI's public product positioning](https://loopsai.com/), but uses independent local code. Vendor outcome claims remain unverified. Live OAuth, native health bridges, paid connections, mobile companions and production enterprise operation remain future acceptance work.
