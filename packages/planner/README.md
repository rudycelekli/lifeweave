# @lifeweave/planner

Optional host-owned OpenAI-compatible model adapter for a user-requested presentation proposal. The default console remains deterministic and has no configured model. This package has mock transport acceptance only; a real local model or user-owned gateway needs its own live canary, privacy review, latency/cost measurement, and output quality evaluation.

```js
import { createModelPlanner } from '@lifeweave/planner';

const planner = createModelPlanner({
  endpoint: 'http://127.0.0.1:11434/v1/chat/completions',
  model: 'your-installed-model',
  maxRequests: 1
});
const proposal = await planner.propose({
  state,
  goalId: 'goal-learning',
  request: 'Make this focus scenario easier to scan.',
  interactive: true,
  now: new Date().toISOString()
});
// Review proposal.surface and revalidate current consent/freshness before displaying.
// A proposal is never merged into state automatically.
```

Only loopback HTTP at the exact `/v1/chat/completions` path is accepted by default. User information may reach a remote HTTPS gateway only when the host explicitly sets both `allowRemote:true` and `allowDisclosure:true`. URLs with userinfo, query, fragment, other paths, or redirects are forbidden. API keys remain in a closure and an authorization header; they are absent from prompts, return values, and error text. Raw observation bodies/summaries, connection records, and unrelated goals are not sent. Source timeline labels are replaced with generic evidence labels. Known supplied credentials and obvious credential markers in a prompt or response cause rejection; this is a targeted guard, not a general secret-detection guarantee.

The planner first requires a currently eligible core surface for an explicitly active goal. Default proactive proposals honor live quiet hours, delivery history, and attention budgets. For an explicit user request, the host may set `interactive:true` to inspect core replay grounding; this bypasses display gates only and still checks tenant, scope consent, freshness, candidate status, and feedback. The host must never derive interactive intent from mail, other evidence, or model content. A goal with no actionable evidence produces no model request. Sensitive sleep evidence can ground a proposal only while its health scope is valid.

The model can rephrase copy, reorder existing blocks, and adjust calculator defaults within their original bounds. IDs, evidence, timestamps and expiration, priority, confidence, action declarations, metric values/targets/units, trend points, calculator expressions/bounds/steps, and block counts remain fixed. Unsupported or fabricated output is rejected. The model cannot invoke tools, add authority, activate goals, or create measured progress. Copy can still make unsupported claims: `requiresReview:true` is permanent, and human semantic review plus a fresh host policy check is required before use.

Each adapter has a lifetime attempt cap, default one. Transport errors and timeouts consume an attempt; there are no hidden retries. Response size, JSON shape, and completion time are bounded. All errors are sanitized `ModelPlannerError` codes and never include provider response bodies or transport exception messages. Host changes to grounding during the await invalidate the proposal.

Run `node --test ../../tests/planner.test.mjs` from this package directory, or `node scripts/verify.mjs` to save a TAP transcript and source-hashed JSON receipt. Tests use injected mock transports; no paid provider, remote model, or local model call is made during verification. This adapter is a presentation constraint layer, not learned routing or evidence of improved goal outcomes.
