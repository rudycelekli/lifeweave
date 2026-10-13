# @lifeweave/core

A dependency-free JavaScript ESM package that turns explicit goals and consented structured observations into declarative UI surfaces. Its five deterministic rules are transparent and replayable. It does not train a model, execute external tools, infer commitments from email bodies, or prove improvements in goal attainment.

```js
import {
  createDemoState, evaluate, ingestObservations,
  applyFeedback, recordSurfaceDelivery, validateSurface
} from '@lifeweave/core';

let state = createDemoState('2026-10-13T16:00:00.000Z');
const result = evaluate(state, { now: state.fixture.clock });
// Render only validated SurfaceFrames with text nodes, never innerHTML/eval.
for (const frame of result.surfaces) {
  if (!validateSurface(frame).valid) throw new Error('Invalid surface');
}
// Acknowledge only after the user actually receives the surface.
state = recordSurfaceDelivery(state, result.surfaces.map(s => s.id), { now: state.fixture.clock });
state = applyFeedback(state, {
  surfaceId: result.surfaces[0].id,
  kind: 'snooze',
  until: '2026-10-14T17:00:00.000Z'
}, { now: state.fixture.clock });
```

`validateState(unknown)` and `validateSurface(unknown)` return `{valid, issues}`. Evaluation and mutation methods throw `ValidationError` on invalid input. `ingestObservations` and feedback/delivery methods return new JSON states; the caller owns tenant-partitioned persistence. No credential belongs in this state. Connection records containing common secret fields are rejected.

The public types are in `src/index.d.ts`. Browser and Node imports use the same API; there are no Node-only imports.

## Observation contracts

| Kind | Required read scope | Maximum evidence age | Actionable data |
| --- | --- | --- | --- |
| `mail.message` | `mail.read` | 14 days | Raw imported message; no planner action until host confirmation |
| `mail.commitment` | `mail.read` | 14 days | `data.dueAt` and `data.completed:false` |
| `calendar.event` | `calendar.read` | 48 hours | Raw imported event; no inferred availability |
| `calendar.availability` | `calendar.read` | 48 hours | `data.startsAt`, `data.endsAt`, `data.available:true` |
| `health.sleep` | `health.sleep.read` | 7 days | `metrics.sleepHours` and an active goal with user-chosen `sleepHours` target |
| `relationship.contact` | `contacts.read` | 90 days | `data.lastContactAt`; optional `data.personLabel` |
| `metric.update` | `manual.read` | 30 days | Explicit measured metric matching a goal metric key |
| `manual.note` | `manual.read` | 30 days | Context only; missing measurements remain unknown |

Every observation has `id`, `tenantId`, `connectorId`, `kind`, `occurredAt` with timezone, explicit `goalIds`, and `summary`. A connected matching connector, explicit nonfuture `consentAt`, required scope, and unexpired consent are checked on every ingest and evaluation. Future observations and evidence at or beyond its age limit are excluded. Revoking consent immediately invalidates all dependent surfaces, even previously delivered ones.

Metadata is inert JSON. Narrative prompt injection remains text and cannot activate a goal, invoke a tool, or change policy. Evidence cannot supply authority fields such as `scopes`, `capability`, `instructions`, or `permissions`. Prototype keys, getters, cycles, hidden values, invalid dates, nonfinite metrics, and excessive input sizes are rejected. These checks reduce authority confusion; hosts still need access controls and a text-safe renderer.

## Surface and attention contracts

SurfaceFrame blocks are a strict union: `text{text}`, `metric{label,value,target?,unit}`, `checklist{items:[{id,text,done}]}`, `timeline{items:[{at,label}]}`, `trend{label,unit,points:[{at,value}]}`, and `calculator{label,inputs,outputs}`. `null` is a valid unknown metric value; rules never replace unknown data with zero. Unknown block and render fields are invalid.

Calculator inputs are bounded numeric controls `{id,label,value,min,max,step?,unit}`. Outputs are `{id,label,unit,expression}`. Expressions contain finite numbers, `{var:inputId}`, or `{op,args}` with `add`, `subtract`, `multiply`, `divide`, `min`, and `max`. Subtract/divide require exactly two arguments; other operators accept two to eight. A calculator has one to eight inputs and outputs, expression depth at most six, and at most 80 expression nodes across its outputs. IDs are unique and all variable references must resolve to defined inputs. Defaults must produce finite outputs. `evaluateExpression(expr,variables)` is browser-safe, rejects zero divisors/nonfinite results, and never uses executable code or host globals. The renderer must enforce each control's declared bounds before evaluation and show a validation error if a scenario is undefined. Changing a calculator input is a local hypothetical scenario; it does not create measured progress, update evidence, or alter consent.

Every frame links active goal and current source observation IDs, and expires no later than its earliest source expiration. Surface IDs are stable noncryptographic identities of tenant, goal, rule, and evidence IDs; they are not signatures. Fixed `confidence` values describe rule evidence sufficiency and are not calibrated probabilities or predictions of goal achievement. Generated actions are local planning intents. Declared external actions require a known capability and `requiresApproval:true`; the core never executes them. `canUseCapability` reports current scope consent, while the host remains responsible for per-action approval and revalidation.

Live evaluation honors IANA timezone quiet hours including DST and a daily surface budget. The evaluator is pure: persist `recordSurfaceDelivery` only after actual rendering for durable budget accounting and deduplication. Acknowledged surfaces remain visible on the same day; unchanged signals do not republish the next day. Done and dismiss hide the exact evidence-linked surface. Snooze resumes after its explicit deadline if current evidence still qualifies. Feedback does not claim an email was sent, a calendar event was created, or a goal was achieved. New relevant evidence may produce a new surface identity.

Replay mode bypasses quiet hours, delivery history, and budget only. It still enforces tenant boundaries, current consent, evidence freshness, candidate/paused goal exclusion, and feedback. It is for testing and synthetic demos, never an external-action permission bypass.

## Domain boundaries and verification

The source uses goal-system, observations, action-policy, proactive-planning, shared-context, intent-planning and outcome-ledger bounded contexts. Domain objects and application services are concrete modules; no empty scaffold placeholders were added. No AgentDB/registry MCP was available in this session; local state files and repository ADRs are the documented fallback, and no remote registration is claimed.

Run meaningful replay and adversarial tests from the package directory:

```sh
node --test ../../tests/core*.test.mjs
node scripts/verify.mjs
```

The verification command saves a TAP transcript and a JSON receipt with source SHA-256 hashes in this package directory. Those hashes identify local tested artifacts; they do not establish truth or live acceptance. An independent audit checks active-goal, tenant, scope, freshness, consent-expiration, and budget invariants across 64 intervention states. Type declarations are included and the workspace verification runs the installed TypeScript compiler.

The demo fixture is entirely synthetic, including historical goal material. All live catalog entries default to disconnected. `CONNECTOR_CATALOG` distinguishes actual local JSON normalization contracts from live OAuth/desktop integrations that require a host adapter and configuration. Live integrations and user outcomes require their own end-to-end validation.

## Shared context and outcome evidence

`buildSharedContext(state,{now})` projects active goals, eligible evidence, explicit people/projects and latest typed measurements. `upsertContextEntity` returns an immutable state with a bounded same-tenant entity. Similar labels do not merge. Optional `data.entityIds` links source observations to known identities.

`compileIntent(state,{request,goalId?,minutes?,answer?},{now})` supports a small English focus grammar. It returns `ready`, `needs-clarification`, or `unavailable`; current confirmed calendar evidence bounds any ready scenario. Continue a question with its exact `{questionId,value}` choice. If a goal answer leads to a duration question, carry the returned goal ID. Hosts must retain the original input and fresh-revalidate before using an expiring preview. No model or external tool is called.

`detectContextGaps(state,{}, {now})` enumerates missing consent/source/typed measurement or commitment facts. `resolveContextGap` returns an inert typed proposal. After explicit user confirmation, the host can call `recordContextCorrection`; it adds a source-revision-bound annotation and preserves raw source data. `effectiveObservation` exposes the eligible projected view. Confirmation cannot invent metrics, grant scopes, or activate goals.

`capturePlanBaseline` records a current typed measurement if available. `recordPlanOutcome` saves a bounded user report for an evidence-grounded local draft without mutating measurements. `buildOutcomeLedger` separates drafts, reports, actual later measurement links and comparable deltas. Comparisons require identical declared metric key/unit/direction/target; attribution is always `not-established`. `pruneContextData` removes source-dependent extensions after revocation, retaining independently authored entities. The host remains responsible for removing source bodies and atomically persisting the pruned state.

All extension APIs and receipt shapes have public types in `src/index.d.ts`. The workspace verification runs tests, TypeScript and frozen synthetic replay. These mechanisms do not establish real source accuracy or improved personal outcomes.
