# Independent model console review

Review date: 2026-10-13. Scope: candidate `0.1.0-alpha.2` explicit presentation requests, current-state validation, console lifecycle, attention receipts, and consent-derived drafts. This review used invented fixtures, in-memory DOM, and isolated loopback HTTP tests. No real accounts, historical personal sources, or model inference were used by the reviewer.

Result: **40/40 targeted regression tests passed; no unresolved blocking finding in this reviewed scope.** The default proactive queue remains deterministic. Model generation occurs only after an explicit request and does not award progress or execute an external action.

## Findings and resolution

| Finding | Evidence | Candidate resolution |
| --- | --- | --- |
| Public alpha planner reused its pre-request clock and captured state after awaiting transport. | Baseline public revision `420f38c17858225e3843fbb6ca63ca27ea81881f`; source inspection. | `packages/planner/src/index.mjs` obtains a fresh host clock and latest state, then shares revalidation with server review. Tests reject expiry, replaced revoked state, changed goals, regressing clocks, and shortened permission expiration without extending original expiry. |
| Public alpha workspace switching retained the open goal editor. | Baseline source inspection; an editor could carry a personal goal into another workspace. | `apps/web/app.mjs` clears editor, scenario, presentation and delivery state on workspace changes. Request callbacks are bound to workspace, load generation and current frame grounding. |
| Partial health scope removal retained saved drafts derived from deleted observations. | Baseline source inspection. | `apps/web/server.mjs` removes dependent drafts alongside observations on scope reduction and revocation. Independent HTTP tests confirm removal from state, draft API and persisted file. |
| Accepted views or evidence could remain mounted after a changed poll while a form retained focus. | Candidate source inspection. | Policy and frame changes force disposal and rendering even during editing. An independent in-memory full-console check confirmed that source revocation removes the accepted view and revoked evidence despite a focused draft form. Stable polling preserves an in-flight explicit request. |
| Choosing “Keep the original” while acceptance review awaited its response still applied the view afterward. | Independently reproduced before repair: one acceptance after discard, expected zero. | `apps/web/request-panel.mjs` now checks a preview revision after await; discard and disposal invalidate it. Regression passes with zero late acceptances. |
| A review response could substitute wording the user had never previewed. | Adversarial regression. | Exact returned surface equality is required before acceptance; unseen replacement wording is rejected. |
| Concurrent local hosts on different ports overwrote the same browser session cookie. | Parent browser reproduction; independent two-host regression. Browser cookies do not distinguish ports. | `apps/web/server.mjs` initializes a distinct cookie name from its actual listening port. The combined cookie jar authenticates both hosts; the other host's cookie alone is rejected. HTTP origin and CSRF checks remain required. |

## Verification

Run from the repository root with Node 24.19.0:

```sh
node --test tests/planner.test.mjs tests/request-panel.test.mjs tests/host-model.test.mjs tests/server-model.test.mjs tests/server.test.mjs
```

The final result was 16 planner, 7 request-panel, 2 host configuration, 7 model-server and 8 local-server tests, all passing. Checks cover malformed frames, forged measurements/actions, tool calls, secrets and transport error sanitization, bounded requests, timeouts, missing CSRF, remote configuration rejection, cross-workspace proposals, nonblocking revocation, health draft deletion, concurrent hosts sharing a cookie jar, and progress remaining unchanged after feedback.

The additional full-console DOM experiment loaded the actual app module with synthetic host responses. It verified zero model calls at mount, stable polling during a pending request, mounting the reviewed view, and removal after revocation during editing. This experiment was executed in memory; its harness is not a committed regression fixture. UI invalidation uses the next foreground poll, currently 60 seconds, or another reload; it is not instantaneous cross-tab push synchronization.

Reviewed source hashes:

| File | SHA-256 |
| --- | --- |
| `packages/planner/src/index.mjs` | `45dd6cc1ebc1cc50df5719eb506bc6613e76a42d8e964fe2c98eb5c76a81b653` |
| `apps/web/server.mjs` | `e0f8da22383ae9cf3cbb9b4b498c4672964bfebcdee0b45ba04c065274d9177d` |
| `apps/web/app.mjs` | `9438a7dd44b9c50e2f776d18dcf28b4a0a03a872bc0235f8b6e2388bd6385646` |
| `apps/web/request-panel.mjs` | `c56eddb822259a8d2b21020fe435d28408521ea8cfe96274524a6325e5b51eb4` |
| `apps/web/host-model.mjs` | `96b9ed4f6e88eb830d6d323a945e60b732a288b6d0ed228810fd315652dcbe19` |

## Limits

This is a local alpha review, not proof of production multi-user security or useful life outcomes. Model wording remains untrusted and requires human review. A loopback transport can forward to a remote provider; execution location remains unverified by the generic transport contract. Model calls are disabled by default and require explicit host settings.

The separate parent-run receipt, [local-model-canary.json](local-model-canary.json), records one real local-service attempt against an invented goal. It was rejected as `invalid-surface-frame` after 4578 ms, leaving goal measurements unchanged with zero external actions. That canary supports fail-closed behavior for this one attempt; it does not establish successful generation or model quality. Its server hash predates the capability-status field removal and port-specific cookie repair and is retained as the exact tested hash.
