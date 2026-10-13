# One home, the right response

Today is the primary home. It shows at most three current moves, one suggested place to start, and a single request box. A working view opens when the person chooses a move. The Workspace disclosure contains existing goals, shared context, outcomes, evidence, connections, research and preferences. No capability was removed to make the default view smaller.

The board is an immutable projection of the existing evidence and attention policy. It ranks current evaluated candidates deterministically, prefers distinct goals before filling extra slots, and respects quiet hours, current consent, source freshness, feedback and daily budget. Candidates omitted by the three-move limit stay uncharged. The UI posts only mounted board IDs; the console host rejects receipts for hidden candidates. Opening a request response does not record a proactive delivery.

With no active goals, Today offers one passive onboarding action. With active goals but no eligible moves, it stays quiet. The board creates no facts, inferred availability, universal life score, account grants or model requests.

## Explicit requests

The deterministic router supports these bounded request families:

| Request | Representation |
| --- | --- |
| What matters today? / Plan my day | Up to three grounded next steps |
| What is next? / What should I do? | One grounded next step |
| How am I doing? / Show my progress | Current typed measurements and unknowns in a table |
| Compare my next steps | Up to three options with their recorded reasons |
| Help me focus on my learning goal for 30 minutes | A scenario bounded by a confirmed calendar window |

This is not general conversational intelligence. Unsupported commands remain unavailable. Sources, metrics, current goals, permissions and action authority remain outside generated presentation. Optional model layout requests still live inside a working view and require the existing explicit configuration/review flow; the worker never invokes them.

Ambiguous goal or unsupported duration wording asks one current question at a time. Answers must match the question identity and a permitted choice. A focus preview is inert until explicitly used. Other ready factual responses are checked with the host immediately before display. Related working views are checked again before opening. Review IDs are workspace-bound, temporary and invalidated by changed source context. Original source bodies, measured values and declared units/targets remain separate; narrative numbers and usefulness reports never become KPI measurements.

The SDK adds `composeDailyBoard`, `compileAssistantResponse` and `validateAssistantResponse` with public TypeScript contracts. The local host adds `/api/board`, `/api/responses` and `/api/responses/review`. Existing focus intents and local draft APIs remain compatible. All writes still need the exact loopback origin and CSRF token.

## Stability and evidence

Unrelated updates do not erase a focused Today draft. Board rows can refresh independently while the working editor stays intact. A changed or revoked source that grounds the active view invalidates it; workspace switching clears private content immediately. Requests cannot mount a delayed pre-revocation response because all ready results receive a fresh host review. Polling stays single flight.

Regression evidence covers policy interventions, hidden delivery scope, unknown measurements, source/tenant/freshness boundaries, strict typed tables, ambiguous choices, real-clock review continuity, malformed or hostile output, stable editing and delayed responses. Browser checks use invented sample data. Native checks use isolated local state. Packed SDK/export-map and whole-archive checks include negative controls. These establish the tested mechanisms, not actual goal attainment, production enterprise readiness, or worldwide superiority.

Prospective qualification should measure usefulness, time to a useful next action, interruption burden, human oversight, mistaken suggestions and independently observed outcomes against a frozen baseline. The compact layout reduces visible navigation from eight permanent sections to one Workspace disclosure; this structural change is observable, while user-task performance still needs measurement. Live OAuth, broader model quality, native mobile, hosted sync and premium services remain separate work.
