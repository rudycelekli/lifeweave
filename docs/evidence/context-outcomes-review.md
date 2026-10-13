# Independent context and outcomes review

Reviewed 2026-10-13. Baseline: public alpha2 revision `96533c3eabca038f5af825aa8e66239e1b1066e0`. Scope: the subsequent candidate implementation of shared context, deterministic focus intent, missing-fact clarification, confirmed source annotations, and the outcome ledger. This receipt records candidate verification, not publication or release acceptance.

**57/57 targeted tests passed. No unresolved blocking finding remains in the reviewed scope.** The reviewer also executed an isolated API experiment and independent core experiments using invented data. No actual personal documents, accounts, model inference, or external actions were used. Existing historical goals remain inactive candidates.

## Evidence distinctions verified

- Saving a draft, handling a suggestion, and reporting usefulness do not mint measurements or change goal metrics. A report describes the person's experience and does not imply completion.
- A comparable change requires an explicitly linked, distinct, chronological later measurement. Baseline reuse, duplicate timestamps, measurements before the draft, future records, and unrelated goals are rejected. Key, goal-declared unit, direction and target must agree; otherwise comparison is unknown. Numeric overflow also produces an unknown comparison.
- Signed measurement differences are descriptive. Attribution remains `not-established`, including when two drafts reference the same later measurement. Aggregate measurement and comparison counts deduplicate these links.
- People and projects use explicit tenant-scoped IDs and goal links. Identical labels do not merge identities. Source revocation removes source-dependent links, baselines, drafts, outcomes and annotations while preserving independently authored entities.
- User corrections fill only missing typed commitment fields. Imported observations remain unchanged. Correction receipts retain the original source fingerprint; changed, revoked or expired source context cannot authorize an old answer.
- Explicit focus requests require active goals and confirmed, current calendar evidence. Requests never create availability, activate historical goals or grant action capabilities. Unsupported or contradictory time expressions ask one bounded question; no-duration requests retain the existing scenario default. Answers must match a current question and exact choice.
- Explicit intent and clarification do not spend proactive delivery budget. Gap pause and snooze receipts are separate from suggestion feedback. Questions appear in collapsed controls; unchanged paused facts stay suppressed.

## Findings repaired during review

| Finding | Reproduction or evidence | Resolution |
| --- | --- | --- |
| Unsupported durations were silently ignored. | `60 seconds` and `2h` became 25-minute scenarios; mixed minute/second wording was partially accepted. | Unsupported units and mixed durations now ask a bounded minute question. Frozen regressions and continuation tests pass. |
| The baseline helper executed an input getter. | A getter on `goalId` ran once before input validation. | The helper inspects inert JSON before reading fields; the regression verifies zero getter executions. |
| Host gap calls put the clock in the input position. | Source inspection identified four invalid calls, including the workspace snapshot and confirmation handlers. | All calls use the input/options contract. Actual API tests pass. |
| Every outcome report was labeled completion. | A report with `not-useful` and zero effort still displayed a completion label. | The UI says “Your reported experience”; actual-app regression verifies that completion is not invented. |
| Accepted intent views could retain stale available time. | A quiet, zero-budget workspace kept an accepted 60-minute window after only 15 minutes remained, because its live queue was empty. | Each foreground poll rechecks the accepted preview with the host. Rejection clears the view and focused draft editor. A committed actual-app regression covers this case. |
| Older concurrent polls could restore revoked evidence. | A newer poll removed an evidence marker; a delayed older response restored it. | Polls are single flight, with cleanup on every exit. Actual-app regression verifies concurrent requests are skipped and the next fresh revocation snapshot wins. |

## Reproduce

Run from the repository root with Node 24.19.0 and the declared development dependencies:

```sh
node --test tests/core-context-outcomes.test.mjs tests/intent-planning.test.mjs tests/server-context.test.mjs tests/workspace-tools.test.mjs tests/app-lifecycle.test.mjs
```

The final result was 13 core context/outcome tests, 23 intent/gap tests, 8 isolated server tests, 9 workspace-tool DOM tests and 4 actual-app lifecycle tests, all passing. The intent suite includes a seeded 200-request malformed corpus. The app suite loads the actual app module, replaces only its host/browser environment, and checks privacy invalidation during focused Context and Outcomes forms. Its first run exposed a fixture URL-encoding error for paths containing spaces; the fixture was corrected and rerun successfully.

The additional isolated API experiment verified: confirmed immutable annotations; stale gap rejection; explicit intent under quiet hours and zero budget without delivery receipts; cross-workspace preview rejection; constrained draft bounds; zero measurements minted by reports; descriptive later-measurement delta; and source revocation cleanup in the mutation response, export and persisted file. Mock model transport counted zero calls, and the host counted zero external actions. Temporary fixture files were removed.

## Exact reviewed sources

| File | SHA-256 |
| --- | --- |
| `packages/core/src/state.mjs` | `ecf1038d874558f474ac2710dc07d5c3fee2d37b4c0494cdb2f56e29ef30ac83` |
| `packages/core/src/index.d.ts` | `21e804f70f121ea3e3ae6aa26b62ce74c7fcdbc6587e0099e362ba389a7afa4b` |
| `packages/core/src/shared-context/application/context.mjs` | `ff200a5d9a88179e5106943ca5b3f8f64fb6a96ada1e01a92c311f0d8bfad765` |
| `packages/core/src/shared-context/application/corrections.mjs` | `08ef0d6aafbbac107640a2af072a9ba315a2e539c63ec27d950c316aa60575a4` |
| `packages/core/src/shared-context/domain/extensions.mjs` | `c50ea309a98fc5b8d057cf9123a8183a01b6b3c705a0c2361e669add88e113f0` |
| `packages/core/src/outcome-ledger/application/ledger.mjs` | `1e807e8467dfc5b2b244a92911e69f9bbb05d51d38c960f053b46361d2dd6ab8` |
| `packages/core/src/intent-planning/index.mjs` | `9b9c6eace5801a85e80bf86e58d313c928cbdaa0c67eea2f58aeede66674337c` |
| `apps/web/server.mjs` | `bbbcc9c07f341a39be43ea4448798147e6af908e1610ef5f1826d5a87add0748` |
| `apps/web/app.mjs` | `09a22e9d18ecd9f748b01153f08169fd4df7cc0ac1d44bdae478bccaaea393f2` |
| `apps/web/workspace-tools.mjs` | `2887645211fc0d0a48ae124f07c1626c5ddf1d0e1f5b848c0862f571ab808afd` |
| `tests/app-lifecycle.test.mjs` | `3a141cb8de3b25b694e9b88f91c4e7505b7f3fdff90304d00ddb0024c01a9ae6` |

## Limits

These fixtures establish the tested contracts, not improved life outcomes or production multi-user security. Measurements retain source IDs and timestamps, but units are declared by the goal rather than independently proven by a provider. The ledger withholds entries when their current evidence is unavailable; it is not a qualified permanent historical analytics system.

Cross-tab UI refresh occurs through foreground polling, currently every 60 seconds, or a reload; this is not instantaneous push synchronization. Host review also checks current facts before a requested view is used or its draft saved. The deterministic interpreter supports a deliberately small focus grammar. Live providers, causal evaluation, automatic identity reconciliation, sync, mobile handoff and external execution remain separate acceptance work.
