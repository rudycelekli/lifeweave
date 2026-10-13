# Independent architecture review — 2026-10-13

Scope: native source audit of the local host, UI renderer, read-only connector adapters, and their composition with core. Targeted in-memory normalization checks were executed with the bundled Node runtime. This is a single-user local alpha review; it is not live account acceptance, a multi-user security assessment, or Agentic QE certification. Parent code was not modified by this reviewer.

Examined source SHA-256 identities, captured before remediation:

```text
apps/web/server.mjs                 09c94c2ac6745702ed6d397f7cc556c1a22c213aad3e088a4a592c3ca5126f61
apps/web/app.mjs                    a9e8dd5368fab47cb7ad8ca00cadddc740e47433b00df68210959231beffe229
packages/ui/src/index.mjs           d6ad039984e869ff235c058850ab375d8cca15c8bbbf49e8200ab1b4c46041b2
packages/connectors/src/index.mjs   7b79443d1a05a579301c478b68ff75912f594cd42d5b3ac8c8c204ec41ed407a
```

## Actionable findings at the reviewed snapshot

| ID | Priority | Examined location | Defect and proposed fix |
| --- | --- | --- | --- |
| R1 | P2 | `packages/connectors/src/index.mjs:14` | Provider IDs are inserted into core identifiers and truncated to 100 characters. A Graph-style `AAMkAGExample==` normalizes successfully but fails core identifier validation; long IDs can collide after truncation. Derive a stable bounded identifier from the full provider ID, retain the original as inert source metadata, and verify the normalized envelope through core validation. |
| R2 | P2 | `packages/connectors/src/index.mjs:16` | The envelope permits a 4,000-character summary while core permits 2,000. A 3,000-character body preview produces an observation core rejects. Apply the core summary limit at the adapter boundary, with subject/body truncation that preserves a useful source preview. |
| R3 | P2 | `packages/connectors/src/index.mjs:4` | `new Date(value)` accepts rollover and ambiguous local timestamps. The health bridge changed `2026-02-30T12:00:00Z` to `2026-03-02T12:00:00.000Z` in the executed check. Require valid timezone-bearing input timestamps; preserve numeric Gmail epoch handling explicitly. |
| R4 | P2 | `apps/web/server.mjs:98` | Updating local consent from health-enabled to `health:false` drops the scope but keeps previously imported health observations in the persisted file and `/api/state`. The planner suppresses them, yet Evidence and goal latest-measurement views still show them. Purge observations for removed scopes, or establish an explicit retained-data policy and hide records outside current consent. Full-source revocation already deletes observations. |
| R5 | P2 | `apps/web/app.mjs:15` | `api()` and `load()` read mutable global workspace across asynchronous requests. A slower personal request can overwrite a later business snapshot while the business heading and subsequent mutation target remain active. Capture workspace and request generation at load start; discard stale responses and block mutation when snapshot workspace differs. This affects workspace correctness, not multi-user authorization. |
| R6 | P2 | `apps/web/app.mjs:32` | The client delivery dedup set uses only surface ID and is cleared only on workspace change. A same-ID snoozed surface returning on a later day is not acknowledged again, so durable daily attention accounting can miss its new delivery. Key by workspace, local calendar day, and surface ID, or rely on the server's idempotent delivery receipt logic. |
| R7 | P2 | `apps/web/server.mjs:137` | Static routes allow all `apps/web/*`, including server source, and check only lexical path containment. Default `.private` paths are denied, but a configured data directory under `apps/web` or a symlink from an allowed asset can bypass that intended boundary. Serve an explicit public asset allowlist and resolve real paths before read; deny the configured private data directory independently of its name. No current default private-file exposure was claimed or reproduced. |
| R8 | P2 | `packages/connectors/src/index.mjs:94` | The AG-UI bridge emits any cloned input as `lifeweave.surface`. Its test currently uses an invalid minimal `{id,title}` object, so the purported SurfaceFrame contract is not enforced. Validate through core before emitting and use a real valid fixture; reject unsupported blocks/action payloads before downstream consumers receive them. No external executor exists here. |

The adapter composition reproductions returned these exact validation issues:

```text
observations[0].id: invalid identifier
observations[0].summary: required text of at most 2000 characters
```

R1–R3 were executed in memory; R4–R8 are source-path findings and should receive targeted integration/browser checks after fixes. No paid tool, remote account, email send, desktop action, or public disclosure was used.

## Boundaries observed to hold

- The server binds `127.0.0.1`, validates the local Host, blocks foreign Origin/cross-site fetches, and requires session plus CSRF on mutations. This protects a local owner workflow; it does not authenticate different humans or processes sharing that owner session.
- Personal and business state files use different tenant IDs. Core validates observation, connection, feedback, and delivery tenant consistency. Serialized writes avoid lost updates between ordinary browser mutations.
- Full source revocation deletes its observations and immediately invalidates dependent planner frames. Atomic private-file replacement uses file mode `0600`; the default private directory is created with mode `0700`.
- The renderer uses `textContent`, validates declarative blocks, and disables external action buttons. Unknown executable/render fields do not reach rendering. Trusted custom registries remain host-owned code.
- Raw mail and calendar adapters produce `mail.message` and `calendar.event`; they do not fabricate commitments or free slots from content. Provider token access remains a closure in the fixed HTTPS GET Graph reader, with redirects disabled.
- The service worker's cache list contains only three public style/icon assets. Personal API state is not cached by that worker.

## Core artifact receipt

Core metadata is aligned to `0.1.0-alpha.1` and Node `>=22`. The refreshed `packages/core/verification.json` and `verification.tap` record 26 passing core tests, zero failures, and source hashes, including package metadata. The invariant test audits 64 deterministic policy intervention states; this is one test case, not 64 separate tests. Type declarations are authored but were not compiled because no TypeScript compiler was available locally.

Fixes and subsequent acceptance remain owned by the host implementation and its integration verification. This review does not establish goal improvement, clinical validity, production readiness, or a world-best ranking.
