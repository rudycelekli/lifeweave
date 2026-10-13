# Independent daily-board review

Reviewed 2026-10-13 against the alpha4 candidate. Baseline: public alpha3 revision `c054edd104b13a76967d145d9084f0d373ba50d9`. Scope: the compact Today board, Workspace disclosure, unified request routing, rendered delivery receipts, stable editing, and privacy through asynchronous changes.

**50/50 focused tests passed. No unresolved blocking finding remains in the reviewed scope.** All data and host services used by this reviewer were synthetic and isolated. No actual accounts, personal documents, model inference or external actions were used.

## Verified behavior

- Default Today mounts at most three current moves. Working tools start closed. Secondary navigation lives inside a closed Workspace disclosure, and the main page has one shared request box.
- Delivery requests name the actual mounted move IDs. The hidden fourth candidate is uncharged, and can fill a handled slot. The host rejects receipts for hidden moves or more than three IDs. Hidden tabs and explicit response views do not generate proactive delivery receipts.
- Briefs, recorded progress, next-step comparisons and focus requests use distinct bounded representations. Unknown measurements remain null/Unknown. Narrative numbers, handled suggestions and user reports do not mint metric values or completion credit. Goal-declared units and current source references remain visible.
- A focused working draft survives an unrelated new observation. Revoking its own source clears the view and unsaved derived text. Context and Outcomes privacy invalidation from the previous iteration remains covered.
- Saving a local draft returns to the compact board with three moves, one request box and closed working tools. The saved record remains a draft; goals and observations stay unchanged, and no outcome or progress is minted.
- Delayed responses cannot enter a different workspace, including a personal → business → personal switch. A pre-revocation progress reply must pass fresh host review before it can mount.
- Core projections are immutable. Candidate and paused goals stay inactive; consent, freshness, tenant boundaries, quiet hours and attention policy remain enforced. Explicit requests bypass display gates while retaining evidence and feedback checks.

## Findings and resolution

| Finding | Evidence | Resolution |
| --- | --- | --- |
| Fresh response validation rejected unchanged frames because generated timestamps differed. | Source review identified full frame equality across generation and later validation. | Only verified generated time fields are normalized. Tests allow 50 ms drift, and reject altered starts, expired frames and changed available capacity. Original expiration cannot be extended. |
| A forged historical goal could appear in an ambiguous goal question. | Independent mutation of a current question passed the original state-aware validator. | Question kind binds the value type; goal choices must match exact current active goal IDs and labels. Forged inactive choices, labels and numeric goal choices are rejected. Backend exact-question continuation also rechecks current facts. |
| A pending response could outlive source revocation before display. | Review of the pending-request lifecycle identified a missing final host check for nonfocus results. | Every ready nonfocus result receives fresh host review before the response callback. The actual-app regression holds an old progress reply, revokes its source, then releases it and verifies that it never mounts. |
| Broad workspace invalidation interrupted unrelated editing. | Alpha3 invalidated Today forms on any workspace policy change. | Today scopes invalidation to the open frame or response's goals, evidence and permissions. Board rows can refresh while focused draft text remains intact; relevant revocation still forces cleanup. |
| A host using an isolated custom data directory could inherit optional historical candidates from its source checkout. | Final local browser QA identified that the candidates endpoint read a checkout-relative private input independently of the configured state directory. No activation or state mutation occurred. | Historical candidates now load only for the canonical private runtime and personal workspace. The copied-source regression uses invented history: custom directories and canonical business/demo workspaces return no candidates, canonical personal storage returns the invented candidates, and active goals stay empty. The focused suite was rerun against the corrected server. |

## Reproduce

Use Node 24.19.0 and the declared development dependencies from the repository root:

```sh
node --test tests/daily-board.test.mjs tests/response-routing.test.mjs tests/server-board-responses.test.mjs tests/assistant-ui.test.mjs tests/daily-board-lifecycle.test.mjs tests/app-lifecycle.test.mjs
```

The result was 12 board, 12 response-routing, 7 isolated host API, 9 assistant UI, 6 new daily-board lifecycle, and 4 preserved privacy lifecycle tests, all passing. Board tests include 64 policy interventions. An additional 306 malformed response substitutions returned validation results with zero exceptions.

The independent API experiment used an ephemeral loopback host and temporary invented state. Hidden-fourth and four-ID receipt requests were rejected without charging attention; acknowledging the three shown moves created exactly three receipts. Progress retained an unknown finance measurement, fresh review succeeded after 50 ms, and an explicit brief stayed within three steps. The progress and brief requests changed no observations or delivery history. Mock inference calls and external actions were both zero. Temporary state was removed.

## Exact reviewed sources

| File | SHA-256 |
| --- | --- |
| `packages/core/src/daily-board/application/compose.mjs` | `314f51da1fa92bde21daae0c72af8dc7e697a0ce0d074ff53c3b18aa73bce97c` |
| `packages/core/src/daily-board/domain/selection.mjs` | `81fdd7fc37c21194a32ac3644cd8a5d672b1794cdfff045689c301f72a46cae8` |
| `packages/core/src/response-routing/index.mjs` | `13853219c427873e4844b1b7356f946f1d5c4b88a2b3bdb798017c907a9cc324` |
| `apps/web/app.mjs` | `f712f7d0413933b57759c262c5e60959fa1f5f92f230d6fc453e9cef3eca7d53` |
| `apps/web/server.mjs` | `ef208a254b688b3fe25ca544e354620b6c4983fc30116ca0018c02e4a4deb455` |
| `apps/web/workspace-tools.mjs` | `1a825dba0b7ccb5f38bbb49d11f3a3074c17ee0c1c1cb0a88dbf3c90a69de619` |
| `tests/daily-board-lifecycle.test.mjs` | `9916818b83beb89328189a7eefcf126cd50c7ebff960ab582f434440b9e1d558` |
| `tests/app-lifecycle.test.mjs` | `7524a391fc11b827fea261a0d717c64cbf6aeba5fdec7925ac194749ba9d959f` |

## Limits

This evidence verifies the tested local contracts and DOM behavior. It does not establish improved life outcomes, a universal product ranking, production multi-user security or visual usability across devices. Browser and native presentation checks are separate receipts.

Requests use a bounded deterministic grammar. Units are goal-declared rather than independently proven by providers. Cross-tab changes appear through foreground polling or reload, not instantaneous push synchronization. Live integrations, causal benefit and external execution remain separate acceptance work.
