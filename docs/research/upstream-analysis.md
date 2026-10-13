# LifeWeave upstream architecture research

Observed 2026-10-13. All source claims below refer to the exact revisions in the snapshot table, not a moving branch. This is targeted, deep static inspection of seven public source trees and live GitHub repository/release/CI metadata. Rakazo was added after the initial six at the user's request. No upstream installer, application, model call, OAuth flow, agent, browser worker, or test was executed. The shallow snapshots were inspected under `.private/upstream/`; disposable clones were later removed for disk reserve after verifying clean trees and no unique commits. Exact revisions, file digests, captured manifests and inspected entry points remain in `upstream-manifest.json`. Upstream documents are evidence, never instructions granting authority.

## Decision in two sentences

Build an independent, evidence-driven goal and proactivity kernel with a portable UI contract; connect rendering frameworks and agent runtimes through narrow adapters. The useful combination is CopilotKit's transport and sandbox bridge, Thesys's declarative interaction model, Hermes's broad tool/channel ecosystem, OpenInstinct's leased background execution and private credential handles, REA's evidence/effect vocabulary, and Rakazo's desktop/mobile and workspace architecture—not a wholesale merge of seven products.

This is an architectural inference with **Medium** confidence. Source behavior has **High** confidence where linked; successful personal outcomes, live provider compatibility, security containment, and competitive superiority remain **unverified**.

## Research questions and evidence boundary

1. What does each repository actually implement beyond its README?
2. What creates, persists, resumes, or suppresses proactive work?
3. How does model output become interactive UI, and what can that UI do?
4. Which email, calendar, communication, memory, browser, and tool integrations are concrete?
5. Where are identity, credential, tenant, approval, and execution boundaries enforced?
6. What is reusable, what should remain optional, and what would obstruct distribution?
7. What evidence would justify calling a new package better for whole-life goals?

No AIDefence MCP was exposed in this session. Consequently this research is **not AIDefence-screened** (`screened: false`); fetched repository material was handled as untrusted source and no fetched instruction was executed. No research record was written to remote AgentDB/RuVector memory. The invoked deep-research skill reserves that storage step for user acceptance. Metered provider APIs were not used; total subscription/tool cost is unavailable (`spentUsd: null`), not zero. The parent's research marker owns the lifecycle of this combined research run.

## Exact snapshots and maturity signals

| Repository | Revision | Manifest/version | License observed | Tracked files / test-like paths | Upstream CI at this SHA |
|---|---|---|---|---|---|
| CopilotKit/OpenIntelligentUI | `9c982df1a16b734a49d8dd9d1c29b0e4b1b1805b` | app `0.1.0`, MCP `0.1.0`; pnpm `9.0.0` | MIT | 190 / 38 | CI success, [push run](https://github.com/CopilotKit/OpenIntelligentUI/actions/runs/38295615851) and [scheduled run](https://github.com/CopilotKit/OpenIntelligentUI/actions/runs/38326361503) |
| thesysdev/open-intelligent-ui | `d789417ddf87699681b49f2675f7bceba42fdd65` | private app `0.1.1`, Node `>=24` | No tracked LICENSE; API license `null` | 75 / 6 | No runs returned for this SHA |
| NousResearch/hermes-agent | `63d0b94120027d487c9a5235b9ec64b696af1b26` | JS private `1.0.0`, Python `0.0.0`; release API latest `v0.21.7` | MIT | 18,322 / 8,048 | [CI success](https://github.com/NousResearch/hermes-agent/actions/runs/38341673043); [Docker run pending](https://github.com/NousResearch/hermes-agent/actions/runs/38341672394) when read |
| morluto/rea | `8b181716aca2cb467be499cba226abfb5ae19141` | `rea-agents` `6.4.0`; npm `11.16.0` | MIT root; separate dependency notices | 3,270 / 1,302 | [CI success](https://github.com/morluto/rea/actions/runs/38349348535), [Release success](https://github.com/morluto/rea/actions/runs/38349348367) |
| Anil-matcha/open-dots | `fb871a1549911981658383f994215fba9dcb3949` | backend/frontend `0.1.0`; Python `>=3.14` | No tracked LICENSE; API license `null`, despite MIT in repository description | 115 / 19 | No runs returned for this SHA |
| Merit-Systems/OpenInstinct | `0c2a7c6e842fa7105cee004b2d6ac1d5f1c7c1e8` | private app `0.0.0`; pnpm `11.24.0`, Node `24.x` | MIT | 526 / 124 | [Checks success](https://github.com/Merit-Systems/OpenInstinct/actions/runs/37373152011) |
| elie222/rakazo | `0394e92c820994ec9978b046f652c3ab4ca85fa5` | root `0.1.0`, desktop `0.2.0`, mobile `0.1.0`; pnpm `9.15.0` | Apache-2.0 | 2,130 / 775 | [CI in progress](https://github.com/elie222/rakazo/actions/runs/38350533751), [server image success](https://github.com/elie222/rakazo/actions/runs/38350533365), [Playwright-report publishing failure](https://github.com/elie222/rakazo/actions/runs/38351012176) when read |

Test-like paths count tracked filenames matching test directories or test/spec naming. These counts include helpers and fixtures and are **not test cases, coverage, tests run, or proof of product maturity**. CI conclusions are provider-reported upstream results, not local replication. CopilotKit, Thesys, Open Dots and OpenInstinct returned empty release lists; Hermes, REA and Rakazo returned release records. An empty list is not proof of no npm/package distribution. All seven checked-out trees were clean after inspection. Live metadata, including observed popularity and timestamps, is preserved in `github-metadata.json`; popularity does not rank engineering quality.

## 1. CopilotKit/OpenIntelligentUI

### What it is

A Next.js chat application, Python Deep Agent, optional MCP HTML assembler, and shared design system. It is the clearest reference among these for streaming arbitrary interactive answers over an agent protocol. It is not a whole-life assistant or a proactive goal service.

### Request and rendering flow

`CopilotChat → /api/copilotkit → LangGraphHttpAgent → FastAPI/Deep Agent → native components or generateSandboxedUi → activity renderer → Websandbox iframe`. The Python agent declares sample-data query, trip images, visualization planning, todo tools, and a form tool; middleware composes request model selection, CopilotKit, Jev routing, and Anthropic compatibility. A bounded process-memory checkpoint store retains up to 200 threads. [C-agent][C-runtime][C-memory]

The runtime enables both A2UI and Open Generative UI and can optionally configure an HTTP MCP Apps server. This is protocol/renderer wiring, not an installed collection of personal-data connectors. The custom UI contract streams ordered CSS/HTML/function/expression channels. Preview morphing strips script/head/style blocks from the body, then the final iframe runs functions and expressions with shared styles/import maps. Incremental previews and final execution have different lifecycles; reuse them only after auditing both. [C-runtime][C-renderer][C-partial]

The renderer supports powerful custom HTML/SVG, charts, animation and 3D via CDN imports. That flexibility also creates a larger execution and dependency surface than declarative components. Final CSP permits inline/eval scripts, selected CDN origins, and limited image hosts. The preview-head builder does not inject the final CSP; iframe isolation and eventual CSP are distinct protections. This is a source observation, not a demonstrated escape. [C-frame]

### Local interaction and authority

The host bridge exposes only `sendPrompt({text})` and `openLink({url})`. Text is trimmed and bounded to 4,000 characters; links require HTTPS and can use a configured origin allowlist. The prompt bridge claims each request once, rejects busy runs, propagates protocol errors, and cleans up pending requests on unmount. These are useful host-adapter patterns. The bridge describes generated prompts as user messages, so LifeWeave must retain provenance and must not equate a model-generated follow-up with human approval for an external action. [C-functions][C-bridge]

The route creates its agent per request. BYOK headers are explicit, bounded, removed from downstream ASGI scope, stored in a ContextVar for the stream lifetime, and excluded from credential representations and hosted traces. Checkpoints use a key-derived private thread namespace; this is credential scoping, not a general authenticated tenant model. Configured server credentials remain usable by direct clients that omit BYOK headers. The optional per-IP rate limiter defaults off and lives in one process. A shared deployment needs stronger identity and quota enforcement. [C-credentials][C-keys][C-route]

### Proactivity and evidence

No product scheduler or event intake is declared by the inspected agent/runtime. The sample query tool explicitly returns all bundled CSV rows, `is_sample: true`, and `query_applied: false`; charts over that data are not live telemetry. Jev chooses among 13 presentation categories with bounded confidence/probabilities. It is an additional service dependency; failures surface rather than silently falling back. Routing suitability is separate from factual correctness or goal benefit. [C-query][C-router]

Checkpoints are ephemeral and the saver documents single-process, non-thread-safe assumptions and dependency on LangGraph internals. The updated implementation moves a reused thread to the end, even though its docstring says FIFO: use the actual code when copying semantics. Launch telemetry sends installation/runtime metadata to CopilotKit unless disabled; it is not personal KPI telemetry. Privacy-oriented distribution should disclose and default-disable such telemetry. [C-memory][C-telemetry]

### Integration judgment

**Reuse:** AG-UI boundary, separate native/custom rendering rails, validated narrow bridges, credential stream lifetime, error propagation, source-aware sample labeling, and renderer/browser tests. **Adapt:** make provider selection optional, replace ephemeral state, require authenticated workspace scopes, and enforce generated-artifact egress and resources. **Avoid inheriting:** mandatory Jev dependency for all turns, direct privileged agent endpoints, generated prompts as authorization, anonymous shared-key access, and always-on install telemetry.

The MCP `assemble_document` tool returns text; a host must render it and validate its bridge. It does not carry the Websandbox import map or become a browser UI merely by being called. [C-mcp]

## 2. thesysdev/open-intelligent-ui

### What it is

A small, recently created Next.js demo for OpenUI Lang 1.0. Its strongest contribution is composable, reactive generated UI with an explicit catalog of permitted components and functions. The repository is a private app package rather than a published general assistant SDK. [T-package][T-page]

### UI and state flow

The component library defines layout, text, inputs, media, tables/charts/maps, playful widgets, SVG, and an HTML escape hatch. Schemas and component group notes form a machine-readable library spec and prompt. Inputs bind to `$variables`; generic functions compute locally, and actions update state or return a selected value to the assistant. The browser does not need another model round trip for every slider, allocation, filter, or list toggle. [T-library][T-patterns]

This is a promising basis for transparent KPI tools: formulas and inputs can stay inspectable while updates are deterministic. The tests exercise evaluation order, reactive iteration, per-person split calculations, clipboard action plans, and once-per-click randomness. Gallery programs are parsed against the generated catalog and checked for unresolved/orphaned values. These are better mechanisms than asserting a screenshot merely looks plausible, although they do not establish numerical correctness of every generated formula. [T-patterns][T-gallery]

The root page uses an OpenUI AgentInterface with Responses streaming adapters. Conversations and assistant page state persist in browser localStorage, bounded to 50 thread records. This supports reload/resume within one browser; it is not cross-device, encrypted, server-authoritative, or a tenant-safe personal knowledge store. [T-page][T-storage]

### Generation and provider boundary

`/api/chat` has two paths: OpenUI Gateway Responses, which sends the library spec and relies on gateway correction; or direct OpenAI-compatible Chat Completions, including Ollama shortcuts, with a locally generated prompt and no correction step. The server rejects system-role messages from the browser, limits retained history to 60 items, checks JSON content type, bounds the body after reading, sets `store:false` on the cloud request, and propagates browser aborts. The inspected handler has no authenticated principal or per-user spending quota. [T-chat]

These provider paths are real source implementations, but none was called here. The README's speed/quality claim is not a measurement from this research. The benchmark harness distinguishes `--fake`, saved-answer rechecks, and actual model generation; it collects usage/time and parses output before optional screenshots at multiple widths. A fake benchmark run cannot demonstrate model generation quality. [T-bench]

### Sandbox, network and external data

HtmlView creates an opaque-origin `allow-scripts` iframe; no same-origin, forms, popups, or top navigation are enabled. The host validates resize message source and finite height, capped at 1,200px. CSP blocks most resource types while allowing inline/CDN scripts and HTTPS images. Its comment says no other network, but `img-src ... https:` permits arbitrary HTTPS image origins; a whole-life package should proxy/allowlist images before putting private data into generated HTML. [T-html]

Declarative styles reject resource-loading CSS syntax and URLs require HTTP(S). Media resolves photos via Wikipedia/Commons; street geometry uses the public OSRM driving demo. Those queries leave the app, are cached, and are not private email/calendar/health connectors. The map path does not establish walking or transit guidance. [T-style][T-media][T-images][T-route]

### Proactivity, maturity and adoption

No scheduled/event-driven personal assistant loop is present in the inspected app. It waits for a chat request or UI action. There are meaningful function/catalog tests and a benchmark script, but no tracked GitHub workflows and no workflow run returned at the pinned SHA.

**Reuse as a design pattern:** schema-derived catalog, reactive state, deterministic formulas, catalog/parser conformance, saved-answer replay, and provider interchange. **Integration prerequisite:** the repository has no tracked license and GitHub reports `license:null`; do not copy its component/function implementation into distributed LifeWeave. The underlying OpenUI packages have their own licenses and API stability, which must be checked separately if a real adapter imports them. **Avoid:** storing whole-life data in plain browser storage, cloud correction as the only validator, and private data embedded in arbitrary generated URLs.

## 3. NousResearch/hermes-agent

### What it is

A large single-tenant agent platform with CLI/TUI/web/desktop distribution, messaging gateway, tools/skills/plugins, MCP transports, persistent memory, delegation, goals, cron, heartbeat and browser/computer execution. It provides the broadest runtime ecosystem in this set. Its README's exclusivity and cost claims are marketing statements, not conclusions of this audit. [H-readme][H-security]

### Scheduling, monitoring and continuation

Cron has file-lock admission, stale-owner recovery, durable next-run advancement before recurring execution, parallel worker dispatch, pause/stop admission and degraded-store behavior. Advancing before execution favors at-most-once admission over catch-up; it does not guarantee the external side effect happened exactly once. It has credential/delivery/skill preflight and separate delivery logic for multiple platforms. [H-tick][H-preflight][H-delivery]

Monitor jobs run a cheap script or URL before calling a model, hash stable source output, and suppress unchanged runs. Changed output produces bounded diff/current context; source failures remain errors and preserve the prior hash. State is persisted before the agent runs so one failed model call does not repeatedly re-alert on the same bytes. The tradeoff is that a failed agent run can consume the change; retrying analysis and notifying need their own state. URL source fetching is bounded by time and bytes but uses HTTP(S) scheme checks, not a destination policy in the inspected function. A server-side deployment needs private-address/redirect controls. [H-monitor][H-monitor-tests]

Heartbeat is per-session persisted state, minimum interval one minute, driver polling five seconds, idle-session admission, coalesced missed ticks, and refund of an admitted attempt that never entered the runner. Owner lineage is rechecked around session resets/compression. However its prompt instructs a brief unchanged reply; it is not by itself a deterministic quiet-notification policy. [H-heartbeat][H-heartbeat-owner]

Hermes also has standing session goals, a judge, default 20-turn budget, continuation contracts, subgoals, WAIT barriers, shell verification gates, and parse/transport failure limits. The judge initially fails open toward continuing. This is an autonomous execution goal loop for a concrete task, not a formal whole-life OKR/KPI observation model. A judge reading the agent's final text cannot establish sustained health, relationship or career improvement. LifeWeave should reuse completion-contract ideas while keeping outcome verification independent. [H-goals]

### Tools, connectors, channels and memory

The registry discovers self-registering tool modules with AST inspection and cache; plugins/tools execute Python. Connector targets distinguish managed hosted accounts from local MCP entries. Transport URLs/credentials are sourced from catalog/configuration, not arbitrary tool arguments; connected state is backend-witnessed, not claimed by the card. MCP OAuth supports scope-aware providers, token reload across processes, and concurrent-401 recovery deduplication. [H-registry][H-targets][H-connect-contract][H-mcp-auth][H-mcp-config]

Concrete source paths include gateway delivery for Telegram, Discord, Slack, WhatsApp, Signal, Matrix, Mattermost, Feishu/DingTalk, email, BlueBubbles and webhook. Platform coverage does not mean all credentials or enterprise tenant consent are configured. The Google Workspace skill includes Gmail/Calendar/Drive/Docs/Sheets and OAuth credential files; Himalaya supports email workflows, and Apple skills cover Notes/Reminders/iMessage. These are installable workflow/integration surfaces with separate provisioning, not magically available accounts. No native HealthKit/Fitbit/Oura/Strava/Garmin adapter appeared in the targeted tool/skill path search. [H-delivery][H-google][H-triage]

Curated MEMORY.md/USER.md become frozen snapshots at session start; writes persist to disk while leaving the current prompt prefix unchanged. Background replace/remove operations pin the reviewed entry before approval. The memory gate explicitly fails open if its module cannot load. Source-dependent failure semantics matter more than the generic term “self-improving.” Skill creation and retrieval are observable mechanisms; they are not proof of neural training or better personal outcomes. [H-memory]

### Security and distribution implications

The upstream security policy explicitly defines a single-tenant trust envelope and OS-level containment. A terminal sandbox contains shell/file operations but does **not** contain Python code execution, host MCP subprocesses, plugins, hooks or skill imports. Whole-process wrapping is the documented posture for untrusted email, web, channels and MCP input. Environment scrubbing and pattern gates are heuristics, not containment. Computer-use config defaults to standard permission mode and telemetry disabled; unrestricted mode is tied to session YOLO. These defaults must be verified with a real deployment before granting desktop access. [H-security][H-cua]

**Reuse:** optional isolated runtime/channel adapter, cheap monitor gate, heartbeat ownership, user-facing credential recovery, managed connector state machine, completion contracts, provenance-sensitive inbox workflow and multi-platform distribution lessons. **Avoid:** embedding its privileged interpreter/plugins into our core process; using YOLO as the normal policy; inferring permission from remembered goals; relying on fail-open helper modules or a model judge for action authorization; treating the very large source tree as a lightweight UI dependency.

Latest release metadata is `v0.21.7`, but JS/Python manifest versions differ. Pin the actual release artifact and protocol in any bridge. The inspected source snapshot is not that release by assumption. There is broad OS/install/runtime test infrastructure and upstream CI success; Docker publication was pending when observed. No Hermes runtime was installed here.

## 4. morluto/rea

### What it is, and why it was not needed

REA is a local CLI/MCP reverse-engineering and evidence system, not a personal assistant or generative UI framework. It inspects supplied JavaScript/Electron bundles, native binaries, managed code, artifacts, saved network/capture data, and selected live targets through optional providers. The seven targets have readable source trees, so binary instrumentation would add authority and cost without answering the present architecture questions. No REA installer, analysis provider, process capture, native GUI, device, or Frida operation was invoked. [R-readme][R-architecture]

### Architecture worth studying

Shared application workflows sit between pure domain/contracts and provider adapters, with separate CLI/MCP edges. Providers are selected and bound deterministically; source/evidence records have narrow reader/writer/unknown-registry ports. Target execution authority is separate from reading a detached evidence bundle. This maps well to a whole-life assistant: inspecting a calendar fact is different from changing the calendar. [R-architecture][R-records]

Evidence records include subject digest/format/local path, provider identity/version, analysis profile, operation, parameters, raw and normalized values, confidence (`observed/derived/inferred`), authority, execution environment, limitations, relationship coverage, locations and linked evidence IDs. The semantic ID is checked against canonical content. Integrity protects correspondence to the record; it cannot make an inference true. The Unknown registry explicitly separates resolution validity from truth verification. [R-evidence][R-records]

### Effects and trust

Every public tool has canonical effects for target/session mutation, filesystem writes, process launches, network access, UI change, discarded data, foreign-code execution and device mutation. MCP hints derive from those effects rather than tool-name guesses. Unknown effect audits throw instead of silently receiving safe metadata. Foreign target/provider output is marked untrusted by default, including error paths. This is the strongest effect/provenance vocabulary in this comparison. The hints are metadata for a consuming host, not an independent authorization or OS boundary. [R-effects][R-registration]

Resource ownership is explicit: bounded artifact reads, pending producer/workspace cleanup, cancellation, capacity, structured failure types and retained diagnostics. Browser scenario secrets are supplied/marked and redacted with encoded variants rather than a blanket inference that all suspicious names are secret. This helps preserve exact evidence while protecting explicitly declared values. [R-resources][R-browser-secrets][R-browser-tool]

### Reuse and limits

**Reuse as independently implemented ideas:** effect descriptors, immutable evidence receipts, source locations, raw/normalized/inferred separation, residual unknowns, provider-bound contracts, ownership/cancellation and reproducible replay. **Optional later use:** authorized opaque app/package investigation when source is unavailable and a concrete feature needs explanation. **Avoid:** granting a life assistant broad REA runtime/instrumentation/device powers merely because the MCP catalog is discoverable.

The root is MIT, but REA includes extensive third-party license/provenance files for engines and helpers. Root licensing does not replace their notices or prerequisites. A source package dependency also has a large platform/runtime footprint. Keep it outside the everyday UI/core installation. [R-package][R-licenses]

## 5. Anil-matcha/open-dots

### What it is

A FastAPI/Postgres backend, Next.js frontend, Telegram bot and Boat sandbox wrapper for coding-agent tasks. The only declared task provider in the inspected launcher is Claude CLI. GitHub device login and optional Parallel Search MCP are concrete integrations; no email/calendar/health connector or general personal metrics domain is implemented in the inspected services. [D-readme][D-execution]

### Task and permission flow

A browser guest or linked Telegram identity submits a task; the backend restores saved provider/GitHub credentials into a user sandbox, writes Claude PermissionRequest HTTP hooks, launches a shell-quoted prompt with a session ID, persists a task row, and polls its status. Reply tasks resume the exact conversation and check active-parent ownership/status. Fernet/MultiFernet encrypts stored credential files and supports key rotation. This is useful source-level credential handling but not an end-to-end secure multi-user deployment. [D-execution][D-crypto][D-task-model][D-reply-tests]

The permission engine checks tool, connector and risk bucket in descending specificity, then defaults to ask. Reads/writes/Bash receive coarse buckets, unknown tools default to system, and Git operations have a classifier. The hook requires a shared bearer token and polls the user's decision up to 110 seconds before deny. That is a practical human decision flow. A Claude PermissionRequest hook is not a universal capability boundary for code running inside a credentialed sandbox. [D-permission][D-permission-route]

### Scheduler and delivery semantics

Three API-process loops poll due schedules, synchronize tasks, and report completion every 30 seconds. Cron fields/timezone are validated and translated to avoid APScheduler weekday/AND-vs-OR incompatibilities. Due schedules use `FOR UPDATE SKIP LOCKED`; next run and queued task commit together, and the `(schedule_id, scheduled_for)` uniqueness constraint deduplicates one occurrence. Backlogs coalesce, late runs beyond 15 minutes are skipped, active runs prevent overlap, orphaned queued launches recover after 60 seconds, and missing credentials pause immediately or after three consecutive failures. [D-main][D-scheduler][D-task-model]

Finished reports claim `reported_at` and commit before Telegram sending. That prevents duplicate claims but can lose notification if the process fails after claim; it is not a durable outbox with delivery acknowledgement. Telegram receives success/error on every run. The frontend shows scheduled outcomes after polling, while web-only users have no push destination. For LifeWeave, separate analysis success, intervention worth showing, delivery retry and acknowledgement. [D-scheduler]

### Major adoption obstacles

The README explicitly acknowledges no real web authentication. The task routes accept `payload.user_id`, lists accept `user_id`, and task lookup uses an integer task ID; permission-answer routes have no authenticated principal dependency. CORS is configured but does not establish identity or tenant authorization. This is a static observation and a clear reason not to put sensitive whole-life data behind an unmodified instance. No exploit was attempted. [D-task-route][D-permission-route][D-api][D-readme]

The README's test limitation is stale: source contains schedule-service and multiple task/router regression tests beyond permission tests. Their presence is stronger evidence than the outdated README claim, but no local suite or live Boat flow was run. Sandboxes are not automatically deleted according to the documented limitation, making cost/resource lifecycle a distribution concern. [D-schedule-tests][D-reply-tests][D-readme]

**Reuse as concepts:** default-ask permissions, encrypted credential records, SQL occurrence uniqueness, timezone tests, recovery and pause-on-auth-failure. **Avoid copying code pending license clarification:** the source tree has no LICENSE and GitHub returns null despite the repository description saying MIT. **Avoid as architecture defaults:** client-chosen identity, shared hook tokens as user authorization, plaintext credential injection into general-purpose task sandboxes, recurring noisy messages, accumulated sandboxes and a cloud sandbox vendor requirement for basic onboarding.

## 6. Merit-Systems/OpenInstinct

### What it is

A Next.js/Eve personal assistant centered on iMessage through Linq, authenticated workspace chat, Kernel cloud-browser workers, a secret vault, Google Workspace, persistent workstreams and dynamic scheduled jobs. It is the closest product match for proactive personal assistance, but it is an application coupled to hosted services, not a general Open Intelligent UI package. [I-readme][I-package]

### Durable scheduled execution and reporting

The per-minute dynamic schedule materializes due runs and claims up to 25 workers/reports per tick. Jobs record owner workspace/user, originating conversation, timing, missed-run policy and revision. Runs have queued/running/waiting/completed/dead-letter state, attempt count, worker and report leases, pending input and durable outcomes. A unique index on `(jobId, scheduledFor)` prevents duplicate occurrence materialization. Worker attempts stop at three with five-minute retry delay; expired leases can recover. [I-schedule][I-schema][I-job-service]

The root agent disables default tools and resolves the user's model at each step. Scheduled execution checks its exact run lease before continuing, so a stale worker does not keep making ordinary root-agent model steps. Internal respond/report endpoints use Vercel OIDC or local-dev route authentication and exact run/lease identities. Resumption preserves pending input and returns explicit 409/422/502 states. These are useful runtime properties, not proof of every delegated side effect being fenced. [I-agent][I-lease][I-channel]

A completed worker hands an outcome to a separate reporting turn in the existing conversation. The reporting instructions send once only if the outcome remains useful/actionable/time-sensitive/material; otherwise they emit an empty delivery. Inactive sessions can suppress delivery; report claims/leases are distinct from execution. This is the best separation of gathering and interruption in this set. Its “useful” decision is model-instruction-driven, so LifeWeave should add deterministic quiet hours, cooldowns, budget, evidence freshness and per-goal thresholds. [I-report][I-report-instructions]

Timing supports one-time, fixed intervals and timezone-aware daily/weekdays/weekly recurrences, with validation and wall-clock/DST handling. Vercel Pro is documented as a requirement because of per-minute scheduling; the actual current commercial terms were not separately researched here. Keep the scheduler portable to a local daemon/host service so a basic personal assistant does not force a paid cloud plan. [I-timing][I-readme]

### Identity, tools and private credentials

Workspace scope is derived from an authenticated principal and cross-checked for Better Auth identities. Browser tools require a delegated child and ownership of both worker/root sessions. Google Connect tokens use a stable user-scoped subject, explicit Gmail modify/Calendar events+freebusy/Contacts readonly scopes and 401 reauthentication. Broad account grants still exist even when a turn's tool list is read-only. [I-scope][I-worker-scope][I-google][I-google-scopes]

Direct Gmail/Calendar tools expose only search/read/freebusy/list to scheduled workers; interactive mode adds Gmail send/reversible updates and event creation. Tests intentionally assert no extra tool approval for those interactive writes. This is a deliberate usability policy, not equivalent to a prospective whole-life assistant having permission to send mail on its own. External communication/calendar invites should require our exact action grant or approved standing policy. [I-gmail][I-calendar][I-google-tests]

Crucial qualification: `run_browser` is available without mode filtering, and the worker includes browser act, Playwright and computer actions. Ownership checks prove whose browser session it is; they do not prove that a purchase, send, form submission or consent action was authorized. Therefore **OpenInstinct scheduled workers are not globally read-only**. LifeWeave needs a broker covering native APIs and browser/computer actions alike. [I-run-browser][I-worker-scope][I-browser][I-computer]

Vault secrets use AES-256-GCM with workspace/item-bound associated data; model-visible tools use opaque candidate handles. Login autofill requires an origin-bound record, current page origin verification and a writable profile; screenshot paths mask tagged secret fields. This reduces secret exposure to model context while still revealing the value to the chosen website/browser provider. It does not remove the need for trusted deployment operators, correct origin binding or per-action authorization. [I-vault][I-fill][I-autofill][I-mask]

### Memory and distribution

Workstreams store notes, evidence, decisions and unresolved steps with workspace/scope identity, revision checks, operation idempotency, a 100-record cap, eight-item active recall and tombstones on forgetting. They are explicitly untrusted notes and never action authorization. Availability is limited to interactive root turns. That is a strong memory correction/authority pattern but not a normalized goal/KPI/event graph. [I-workstreams][I-workstream-service]

The app depends on Eve, Kernel, Linq, Neon/Postgres, private Vercel Blob and AI Gateway; Stripe Link wallet is optional and separately provisioned. Onboarding is polished for that ecosystem but a general package should not require all of it. Real health data, Outlook/Entra, habits, native device telemetry and standalone reactive generated tools remain gaps in the reviewed paths. CI includes checks/runtime smoke, PGlite migration/scheduler tests, browser ownership/autofill tests, and browser benchmark/eval machinery. Their presence and upstream success are stronger than demo screenshots but do not establish our local live acceptance. [I-package][I-schedule-tests][I-google-tests]

**Reuse:** worker/report separation, occurrence uniqueness, lease fencing, owner scopes, pending-input continuity, revisioned workstreams, optional opaque secret handles. **Adapt:** transport/store/provider interfaces, read-only-by-default account scopes, explicit write policy and quiet deterministic intervention gates. **Avoid inheriting:** required Vercel/Linq/Kernel stack, browser actions with only prompt-level intent boundaries, broad OAuth write grants for read-only onboarding and silent assumption that agent memory creates authorization.

## 7. elie222/rakazo

### Relevance to the user's updated direction

Rakazo directly addresses an open-source desktop/local edition alongside hosted web and mobile access. It is an Apache-2.0 beta product with persistent bots, routines, conversations, memory, a ticket board, managed/installed integrations and computer providers. Its distinct value here is distribution and runtime architecture; it does not supply the whole-life evidence/KPI and adaptive UI kernel proposed for LifeWeave. [K-readme][K-package]

The monorepo separates contracts/core/database/adapters/testkit/auth/memory/shared UI from web, API, worker, Electron and Expo apps. Hosted vendor SDKs live in adapters. The worker concretely composes Pi runtime, local artifact/home/memory stores, Graphile jobs, computer providers, optional managed catalogs and MCP. This is a better source match than OpenInstinct for users who want local control plus a monetizable hosted edition. The conclusion is an inference about architecture fit, not proof of business demand or superiority. [K-worker][K-package]

### Local and hosted models

The local provider implementation registers operator-declared OpenAI-compatible model IDs for Ollama, LM Studio, llama.cpp or MLX, with configurable context/output limits, explicit image modality declarations, and a keyless placeholder. Its default endpoint is loopback. Model latency, tool accuracy and hardware adequacy are not measured. The adapter's zero API pricing metadata excludes local power, hardware and maintenance cost; those still belong in total-cost accounting. [K-local-model]

The generic OpenAI-compatible adapter has model probe byte/count limits, DNS-address checks, cloud-metadata/link-local restrictions and HTTPS requirements when authorization is present. Hosted inference and a private gateway can therefore be optional choices, while the core works with a local server. Declaring vision/tool capability does not prove a chosen local model can use it; adapter conformance and task acceptance must be separate. [K-compatible]

Pi runtime registers these provider catalogs and bounds silent tool-result continuation to three attempts. Its self-host tool-call fuse defaults to unlimited when unset/zero. LifeWeave should set explicit per-run model/tool/time/resource budgets and include failed corrections, helper judges and ambient intake in total cost; local API prices or one successful model turn do not establish a low total cost. [K-pi-runtime]

### Routines, durable work and event-driven proactivity

GraphileJobPublisher translates jobs into durable `runAt`, replacement-key and retry limits. Worker concurrency defaults to four; it supervises runner failure and database-capacity backoff rather than silently leaving a dead queue. A reconciler uses PostgreSQL advisory leadership and a 30-second loop to recover queued/expired runs, upcoming routines, outbound messages, computer-control expiry and other stuck state. This is a real scheduler architecture, not an in-memory UI timer. [K-jobs][K-reconcile]

`wakeRoutine` compares the exact scheduled time, active status and bot archive state, validates a target thread/group, then transactionally advances nextRunAt and creates task/run rows. If continuation enqueue fails, it deletes queued rows and restores the schedule claim. It pins the model committed at fire time and records routine provenance. This combines useful scheduling and source identity, but does not establish exactly-once external effects. Schedule-create is withheld from routine-triggered runs to reduce recursive job creation. [K-routine][K-schedule-tools]

Proactivity also includes bearer-authenticated webhooks and GitHub-triggered routines. The webhook endpoint bounds input before bot lookup, uses uniform unauthorized responses, selects active routines, and derives an idempotency key from headers/provider IDs. Authentication establishes the webhook origin's access to intake; event text remains untrusted data and does not become human action approval. [K-webhook]

Ambient team-chat intake batches/debounces messages and applies per-conversation bot rules. Automated senders default to ignore or can use rollup/action policy. A tools-free engagement judge receives bounded context with silence as default; malformed JSON, missing models and exceptions return act:false. The bridge marks ignored versus promoted events and guards exclusive routing ownership. This is particularly relevant to SMB communication overload: a deterministic intake policy can suppress boilerplate before a bounded judge considers an intervention. Standing sender “action” policy can bypass the judge, so the policy owner must be explicit. [K-ambient][K-judge]

Routine output recognizes an exact NO_RESPONSE marker and removes an empty final bubble, and routine-triggered runs do not promote mid-turn narration by default. Silence still depends on the model following the routine prompt, whereas LifeWeave should make freshness/quiet-hours/cooldown and benefit gates deterministic. [K-silence]

### Spaces, people, teams and sensitive observations

Better Auth sessions lead to membership-derived actors; `x-rakazo-space-id` selects among authorized memberships instead of asserting identity. RPC context checks the same user/current space for ongoing stream authorization. SpaceMember binds user, organization and space with composite foreign keys and roles; scoped record helpers reject a mismatched space or user. Owner checks exist for space rename/delete. This is substantially stronger than a client-supplied user ID. [K-auth][K-scope][K-schema]

“Team Computer” means a computer scope shared by bots in one space; dedicated mode scopes a computer to a bot. It is not, by itself, an employee-rights model or proof of isolation among every human member. Computer quotas default to unconfigured/unbounded, and shared/dedicated resources have lifecycle and execution fences. For LifeWeave, personal health, finances, family and private messages should remain in a personal workspace; sharing a business objective should use an explicit projection of permitted facts. An organization's administrator should not automatically receive an employee's personal records. [K-computers]

The inspected schema has space membership, bots, routines and tickets, but no formal objective-owner/KR-observation hierarchy was identified in the inspected runtime and schema sections. Add objective owner, collaborator, reviewer, audience and grant scope as life/business domain concepts instead of treating a bot or chat group as the objective owner. Cross-workspace delegation should receive a bounded brief with provenance and allowed actions, not the person's whole context.

### Integrations, credentials and action policy

Composio/Pipedream are optional managed catalogs. Installed connectors expose remote MCP, HTTP API/OpenAPI and GraphQL sources with user+space-scoped installs, brokered credentials, immutable route identity/revisions and lazy catalogs for large tool sets. MCP fetch has tool/page/result/time limits, checked network destinations and manual redirect handling. Private endpoints need owner/instance policy; ordinary discovery cannot silently become LAN access. The README's Treg resale warning is a **documented vendor prerequisite**, not a licensing conclusion established here. [K-installed][K-mcp][K-readme]

Secrets have application-encrypted or optional Infisical stores; AES-GCM uses record-bound AAD and legacy migration support. AI-sharing consent tracks model/memory/voice recipients per user+space, including routine-specific models. This is useful transparency for a hosted premium edition: connecting a fallback provider changes who may receive data and should not happen invisibly. [K-secrets][K-consent]

The default action policy is deliberately permissive. `shell`, `write_file`, `computer_act`, `browser_act`, app launch and several schedule tools are exempt from general approval. Connector actions are conservatively classified, but the no-rule resolution is allow and model auto-review is optional. Mandatory unattended approval in this code applies specifically to webhook-triggered runs, not all routines. Approved replay binds original arguments and connector resource identity/revision, which is useful, but a strong replay contract does not fix an overly broad default grant. Adopt that binding idea while requiring LifeWeave's universal write/communication/computer capability broker. [K-approval][K-gate][K-effect]

Trusted local-computer mode runs host commands and exposes file/shell capability; its describe() says graphical:false. Managed Docker/cloud computer support and the user's real desktop are different authority surfaces. Do not advertise “local desktop automation” merely because Electron is present, and keep experimental agent execution outside logged-in personal accounts. [K-desktop-adapter]

### Distribution and monetization boundary

Electron offers an existing instance or installs/runs published Docker images under app data. Installed builds pin matching image versions; developer builds use edge. It generates independent secrets and loopback ports, validates health, and leaves the backend running when the app window quits. This can solve persistence/distribution, but introduces Docker prerequisites, disk/RAM, upgrade/backup and runtime ownership. A lighter LifeWeave desktop can keep an embedded/local daemon and use a Rakazo runtime adapter only when computer workflows are enabled. [K-stack][K-desktop]

Electron windows disable Node integration, enable context isolation/sandbox and restrict grants to the current main app origin. Microphone-only media, notifications and sanitized clipboard write are the declared allowed surfaces. Expo provides a separate native client with secure store, document/media pickers, voice and notifications. These are concrete source packages and release metadata, not a verified install from either app store in this research. [K-permissions][K-desktop-main][K-mobile]

Latest GitHub release metadata includes desktop v0.2.0 and Android 1.0.5 (16). At this inspected head, CI was still running, server-image publishing succeeded, and Playwright-report publishing had failed. There is broad offline/postgres/model-emulator/computer-replay and web/desktop/mobile test infrastructure; none was executed locally. Keep beta, release artifact, CI and live acceptance statements distinct.

**Reuse:** provider-neutral contracts, local-model adapter pattern, one API behind desktop/mobile, durable jobs/reconciliation, membership-derived scopes, contextual quiet engagement, brokered connector secrets, explicit AI recipient consent and exact approval replay. **Avoid inheriting:** Docker as a requirement for a first goal card; shared computers as a privacy shortcut; name-based effect classification as the final authority; default allow for routine/browser/shell actions; and assuming open code makes external connector resale/provisioning free.

## Cross-repository comparison

| Dimension | CopilotKit | Thesys | Hermes | REA | Open Dots | OpenInstinct | Rakazo |
|---|---|---|---|---|---|---| --- |
| Primary unit | Chat UI + Deep Agent | Reactive UI demo | Personal agent runtime | Analysis CLI/MCP | Sandboxed coding task | Hosted personal assistant | Persistent bot runtime across local/hosted/mobile |
| Generative presentation | A2UI + streamed arbitrary HTML/JS | OpenUI Lang catalog + HtmlView | Runtime/channel UIs; not this library's core | Evidence payloads, host renders | Task/result cards | Chat/browser activity, not an OpenUI renderer | Chat/tool blocks and shared UI; add independent typed artifacts |
| Durable proactive mechanism | None observed | None observed | Cron, monitors, session goals/heartbeat | None for personal interventions | Postgres cron + polling | Job/worker/report leases | Graphile routines, reconciliation, webhooks, ambient chat |
| Quiet behavior | User request only | User request only | Monitor no-change suppression; heartbeat wording may report unchanged | N/A | Every scheduled run reports to Telegram | Separate model-guided report suppression | Exact silent marker; tools-free ambient judge defaults silent |
| Email/calendar | Sample/native UI; no account connector observed | Public image/map data | Concrete skills/MCP/gateway ecosystem | Analysis targets, not life account sync | Not implemented in inspected service set | Gmail/Calendar/Contacts OAuth | Optional managed/installed connector catalogs |
| Computer use | Generated widget only | Generated iframe only | Browser/native backend surfaces | Authorized runtime/capture/inspection | Boat coding sandbox; no declared GUI surface inspected | Kernel browser/Playwright/computer worker | Docker/cloud GUI; trusted host shell/file adapter |
| Tenant/auth maturity | Credential scoping; no broad tenant model | No authenticated principal in chat handler | Explicitly single tenant | Local caller/target authority | Web identity client-controlled | Principal/workspace/session ownership | Membership-derived organization/space/user scope |
| Universal effect authorization | Narrow UI bridge; no generic action broker | No private tool broker | Heuristic approvals; needs OS wrapping | Detailed effect metadata; host must gate | Coarse hooks/default ask; unauthenticated web answers | Direct-tool mode separation; browser requires extra broker | Scoped effects/replay; permissive routine/browser/shell defaults |
| Whole-life KPI engine | Not observed | Not observed | Session execution goals, not observed life KPI semantics | Not applicable | Not observed | Workstream notes, not normalized life KPI semantics | Not identified in inspected core/schema |
| Distribution friction | JS+Python, extra router key, preview APIs | Simple JS app; unclear repo license | Large runtime and trust envelope | Optional engines/platform limits | Boat/Postgres/tunnel/Claude auth; unclear license | Hosted service ecosystem and paid-plan requirement documented | Electron Docker prerequisite; Expo/server optional; beta |

## Architecture implications for LifeWeave

These are proposed design choices, not capabilities already delivered by a framework.

1. **Goal domain owns success.** Separate life areas, goals, outcome measures, leading actions, commitments, resources, constraints and review dates. Give metrics units, direction, baseline, target, observation time, source identity, coverage, uncertainty and staleness. A habit checkmark is an observation, not automatic proof of health/career improvement.
2. **Evidence before interpretation.** Normalize connector observations without collapsing raw source, derived facts and model hypotheses. Keep receipts source-linked and timestamped. Corrections invalidate dependent suggestions. Borrow REA's confidence/authority/unknown vocabulary and OpenInstinct's revision/tombstone semantics, with a simpler life-domain contract.
3. **Cheap intake before paid inference.** Poll/webhook/export ingestion produces stable facts and cursors; deduplicate change fingerprints before requesting a model. Hermes's hash monitor is a baseline to improve: semantic field fingerprints avoid alerts from irrelevant whitespace/timestamps, while source failures remain explicit gaps.
4. **Proactivity is a policy decision.** Rank expected relevance, urgency, evidence quality, actionable effort, timing and intrusion. Require fresh enough evidence, a goal link, an explanation of why now, a concrete next action and a cooldown. Permit silence. Quiet hours, stale feeds, dismissed suggestions and overload must be deterministic gates outside the model.
5. **Render a typed artifact.** Safe first-party cards can show an opportunity, deadline, progress, habit, planning simulation, calendar gap or decision. Declarative adapters can later translate the same artifact into OpenUI, A2UI, React or mobile. Keep personal facts and action grants outside generated HTML/JS; arbitrary sandbox tools should be an opt-in capability with strict data/egress/resource limits.
6. **Read and write grants are different objects.** A connected account proves availability; it does not authorize every tool. Grants need subject/account/operation/resource, allowed field ranges, expiry, standing-policy reference and audit receipt. A write plan must be reviewable and bound to its exact payload. Browser/computer-use adapters obey the same broker; ownership and a schema are insufficient.
7. **Gather, propose, execute and notify are separate.** Use occurrence uniqueness, leases, bounded retries, dead letters and an outbox. Track worker claim, observation completion, intervention decision, action receipt and delivery acknowledgement independently. Do not label a queued prompt “running” or a text claim “completed.”
8. **Provider and runtime independence.** Optional bridges can call Hermes or other agents; core policy and UI remain lightweight and model-independent. Isolation applies to the whole adapter process, not only terminal commands. Importing third-party plugins into the authority-bearing process is a different risk from using a narrow remote interface.
9. **Distribution starts with zero account secrets.** A local package and reversible sample-data sandbox should run immediately. Imports/iCalendar/CSV/health exports are useful first connectors; real OAuth/native adapters come with live readback acceptance. “Planned connector,” “configured,” “connected,” “last synced,” and “currently healthy” are distinct visible states.
10. **Do not promise goal attainment.** The package can improve awareness, planning and follow-through. Health, relationships, income or other life outcomes require longitudinal evidence and human choices. Treat “world's best” as an ambition to evaluate, not a release claim.

### Personal, business and commercial editions

The same open-source foundation should support a private personal workspace and an explicitly shared business workspace. Each objective needs a human owner and scoped contributors/reviewers; connector grants, observations, suggestions, action receipts and budgets inherit the relevant workspace. A shared objective receives only explicitly shared observations. Personal health/family/financial data remains private even when the person belongs to an organization. Rakazo's space membership is a useful starting pattern, while its bot-shared computer scope is not a substitute for human resource permissions. [K-scope][K-schema][K-computers]

| Edition | Proposed complete foundation | Optional paid value | Evidence still needed |
|---|---|---|---|
| Open-source local desktop | Goal/KPI/evidence engine, local durable scheduling, typed UI, import/export, local or BYOK inference, policy and receipt inspection | No required hosted service | Install/update/uninstall, OS permissions, backup/restore, sleep/wake recovery, package/license audit |
| Hosted personal + mobile | Same domain/API semantics with opt-in sync and authenticated devices | Managed hosting/backup/sync, dependable push, premium provider/integration operations, support | Tenant/device isolation, hosted operating costs, deletion/export, secrets rotation and real mobile delivery |
| SMB/team workspace | Objective owners, roles, explicit fact sharing, approvals, connector scope, delegation and workspace budgets | Managed business integrations, administration, SSO where implemented, audit retention, support/SLA | Cross-user and cross-tenant adversarial tests, role revocation, data-boundary acceptance, enterprise provisioning |

Keep core scheduling, local inference choices and auditability open rather than monetizing removal of artificial limits. Premium services can charge for operated infrastructure and maintained connections, while a self-hoster retains a functional foundation and can bring its own providers. Cloud mobile service and local desktop must expose the same exportable evidence and permission contract. A phone client connected to an awake local server is different from an always-available hosted service; neither should be implied without an installed running backend. Provider licensing, credentials, app-store release, commercial terms and actual pricing need separate confirmation at the chosen release boundary.

## Evaluation contract before superiority claims

Compare against a static goal dashboard and scheduled-text assistant on the same frozen synthetic cases, then separate opt-in live pilots. Keep evaluator fixtures/expected decisions protected from generation prompts; test the evaluator with intentionally wrong units, stale evidence, duplicate events, impossible targets, changed permissions, empty/partial provider pages and adversarial email content.

| Target behavior | Baseline and evidence required |
|---|---|
| Useful proactive interventions | Precision/recall over known opportunities; incorrect/late interruptions; dismissed/repeated suggestions; actionability rated independently |
| Reliable quiet behavior | Zero notification on identical/non-actionable input, quiet-hour suppression, cooldown and overload limits |
| Correct KPI progress | Unit/direction/date windows, incomplete coverage, corrected observations, baseline/target transitions and source-readback comparisons |
| Safe authority | Zero writes without the exact grant, expired/revoked grant rejection, cross-tenant/account denial, browser broker parity |
| Durable execution | Duplicate occurrence, concurrent claim, crash after claim, lease expiry, ambiguous provider completion, idempotency and notification retry/ack replay |
| Generative UI utility | Catalog/schema validation, keyboard/touch/accessibility, deterministic formula correctness, visual/browser acceptance, malformed stream recovery |
| Privacy | Sensitive fields excluded from model/UI/telemetry payloads, secret handles, permitted destinations, export/delete and trace retention checks |
| Real user benefit | Goal-specific outcomes, time saved net of oversight, sustained follow-through, regression/harm observations; no inference from demo completion alone |
| Efficiency | Total tokens/provider cost, generation+correction+retry cost, p50/p95 latency, worker resources, human approval/oversight effort |

## Unresolved integration work

- Clarify licensing before adopting Thesys demo or Open Dots code; validate licenses of any separate library dependencies selected later.
- Choose exact stable AG-UI/A2UI/OpenUI/Eve adapter versions and test actual wire contracts; repository manifests contain several prerelease APIs.
- Run isolated compatibility and adversarial tests before enabling Hermes plugins/MCP/desktop or OpenInstinct browser workers.
- Implement real email/calendar OAuth/native adapters with private account consent, tenant boundaries, incremental sync, token refresh/revocation and provider readback.
- Health connectors are not established by these snapshots; native OS grants/mobile bridges/export import and provider terms need separate research and live checks.
- Define reliable long-running scheduler installation, quiet policy and outbox lifecycle on the user's selected private host. No background job was registered by this research task.
- Measure local installation/build/interaction and protected scenario evaluation. Upstream CI is supporting evidence, not acceptance of LifeWeave.
- Implement objective ownership and workspace-scoped sharing before SMB rollouts; validate that a business administrator cannot retrieve a user's unrelated personal observations.
- Compare a lightweight desktop daemon with the optional Rakazo Docker runtime against install effort, memory/disk, sleep/wake reliability and total cost; do not turn runtime breadth into required onboarding burden.

## Source links at immutable revisions

[C-agent]: https://github.com/CopilotKit/OpenIntelligentUI/blob/9c982df1a16b734a49d8dd9d1c29b0e4b1b1805b/apps/agent/main.py#L36-L77
[C-runtime]: https://github.com/CopilotKit/OpenIntelligentUI/blob/9c982df1a16b734a49d8dd9d1c29b0e4b1b1805b/apps/app/src/lib/copilotkit-runtime-options.ts#L24-L43
[C-memory]: https://github.com/CopilotKit/OpenIntelligentUI/blob/9c982df1a16b734a49d8dd9d1c29b0e4b1b1805b/apps/agent/src/bounded_memory_saver.py#L8-L55
[C-renderer]: https://github.com/CopilotKit/OpenIntelligentUI/blob/9c982df1a16b734a49d8dd9d1c29b0e4b1b1805b/apps/app/src/components/generative-ui/open-generative-ui/renderer.tsx#L247-L330
[C-partial]: https://github.com/CopilotKit/OpenIntelligentUI/blob/9c982df1a16b734a49d8dd9d1c29b0e4b1b1805b/apps/app/src/components/generative-ui/open-generative-ui/process-partial-html.ts#L12-L38
[C-frame]: https://github.com/CopilotKit/OpenIntelligentUI/blob/9c982df1a16b734a49d8dd9d1c29b0e4b1b1805b/apps/app/src/components/generative-ui/open-generative-ui/frame-content.ts#L18-L80
[C-functions]: https://github.com/CopilotKit/OpenIntelligentUI/blob/9c982df1a16b734a49d8dd9d1c29b0e4b1b1805b/apps/app/src/lib/sandbox/sandbox-functions.ts#L11-L109
[C-bridge]: https://github.com/CopilotKit/OpenIntelligentUI/blob/9c982df1a16b734a49d8dd9d1c29b0e4b1b1805b/apps/app/src/lib/sandbox/prompt-bridge.tsx#L24-L123
[C-credentials]: https://github.com/CopilotKit/OpenIntelligentUI/blob/9c982df1a16b734a49d8dd9d1c29b0e4b1b1805b/apps/agent/src/credentials.py#L17-L96
[C-keys]: https://github.com/CopilotKit/OpenIntelligentUI/blob/9c982df1a16b734a49d8dd9d1c29b0e4b1b1805b/apps/app/src/lib/provider-keys.ts#L1-L17
[C-route]: https://github.com/CopilotKit/OpenIntelligentUI/blob/9c982df1a16b734a49d8dd9d1c29b0e4b1b1805b/apps/app/src/app/api/copilotkit/route.ts#L11-L78
[C-query]: https://github.com/CopilotKit/OpenIntelligentUI/blob/9c982df1a16b734a49d8dd9d1c29b0e4b1b1805b/apps/agent/src/query.py#L11-L23
[C-router]: https://github.com/CopilotKit/OpenIntelligentUI/blob/9c982df1a16b734a49d8dd9d1c29b0e4b1b1805b/apps/agent/src/visualization_router.py#L14-L75
[C-telemetry]: https://github.com/CopilotKit/OpenIntelligentUI/blob/9c982df1a16b734a49d8dd9d1c29b0e4b1b1805b/apps/app/src/lib/launch-telemetry.ts#L11-L50
[C-mcp]: https://github.com/CopilotKit/OpenIntelligentUI/blob/9c982df1a16b734a49d8dd9d1c29b0e4b1b1805b/apps/mcp/src/server.ts#L100-L122
[T-package]: https://github.com/thesysdev/open-intelligent-ui/blob/d789417ddf87699681b49f2675f7bceba42fdd65/package.json#L1-L44
[T-library]: https://github.com/thesysdev/open-intelligent-ui/blob/d789417ddf87699681b49f2675f7bceba42fdd65/src/lib/library.ts#L31-L71
[T-patterns]: https://github.com/thesysdev/open-intelligent-ui/blob/d789417ddf87699681b49f2675f7bceba42fdd65/src/lib/functions/__tests__/patterns.test.ts#L5-L60
[T-gallery]: https://github.com/thesysdev/open-intelligent-ui/blob/d789417ddf87699681b49f2675f7bceba42fdd65/src/app/gallery/programs.test.ts#L14-L44
[T-page]: https://github.com/thesysdev/open-intelligent-ui/blob/d789417ddf87699681b49f2675f7bceba42fdd65/src/app/page.tsx#L25-L58
[T-storage]: https://github.com/thesysdev/open-intelligent-ui/blob/d789417ddf87699681b49f2675f7bceba42fdd65/src/lib/chat-storage.tsx#L6-L81
[T-chat]: https://github.com/thesysdev/open-intelligent-ui/blob/d789417ddf87699681b49f2675f7bceba42fdd65/src/app/api/chat/route.ts#L30-L176
[T-bench]: https://github.com/thesysdev/open-intelligent-ui/blob/d789417ddf87699681b49f2675f7bceba42fdd65/scripts/bench/run.mjs#L1-L108
[T-html]: https://github.com/thesysdev/open-intelligent-ui/blob/d789417ddf87699681b49f2675f7bceba42fdd65/src/lib/components/html-view.tsx#L8-L79
[T-style]: https://github.com/thesysdev/open-intelligent-ui/blob/d789417ddf87699681b49f2675f7bceba42fdd65/src/lib/components/style.ts#L5-L23
[T-media]: https://github.com/thesysdev/open-intelligent-ui/blob/d789417ddf87699681b49f2675f7bceba42fdd65/src/lib/components/media.tsx#L37-L56
[T-images]: https://github.com/thesysdev/open-intelligent-ui/blob/d789417ddf87699681b49f2675f7bceba42fdd65/src/app/api/image-search/route.ts#L25-L62
[T-route]: https://github.com/thesysdev/open-intelligent-ui/blob/d789417ddf87699681b49f2675f7bceba42fdd65/src/app/api/street-route/route.ts#L1-L32
[H-readme]: https://github.com/NousResearch/hermes-agent/blob/63d0b94120027d487c9a5235b9ec64b696af1b26/README.md#L20-L33
[H-security]: https://github.com/NousResearch/hermes-agent/blob/63d0b94120027d487c9a5235b9ec64b696af1b26/SECURITY.md#L32-L149
[H-tick]: https://github.com/NousResearch/hermes-agent/blob/63d0b94120027d487c9a5235b9ec64b696af1b26/cron/scheduler_tick.py#L60-L184
[H-preflight]: https://github.com/NousResearch/hermes-agent/blob/63d0b94120027d487c9a5235b9ec64b696af1b26/cron/scheduler_preflight.py#L80-L121
[H-delivery]: https://github.com/NousResearch/hermes-agent/blob/63d0b94120027d487c9a5235b9ec64b696af1b26/cron/scheduler_delivery.py#L29-L120
[H-monitor]: https://github.com/NousResearch/hermes-agent/blob/63d0b94120027d487c9a5235b9ec64b696af1b26/cron/monitor.py#L1-L186
[H-monitor-tests]: https://github.com/NousResearch/hermes-agent/blob/63d0b94120027d487c9a5235b9ec64b696af1b26/tests/cron/test_monitor_kind.py#L325-L365
[H-heartbeat]: https://github.com/NousResearch/hermes-agent/blob/63d0b94120027d487c9a5235b9ec64b696af1b26/hermes_cli/heartbeat.py#L216-L246
[H-heartbeat-owner]: https://github.com/NousResearch/hermes-agent/blob/63d0b94120027d487c9a5235b9ec64b696af1b26/gateway/run_heartbeat_acceptance.py#L12-L44
[H-goals]: https://github.com/NousResearch/hermes-agent/blob/63d0b94120027d487c9a5235b9ec64b696af1b26/hermes_cli/goals.py#L1-L80
[H-registry]: https://github.com/NousResearch/hermes-agent/blob/63d0b94120027d487c9a5235b9ec64b696af1b26/tools/registry.py#L69-L125
[H-targets]: https://github.com/NousResearch/hermes-agent/blob/63d0b94120027d487c9a5235b9ec64b696af1b26/tools/connectors/targets.py#L37-L90
[H-connect-contract]: https://github.com/NousResearch/hermes-agent/blob/63d0b94120027d487c9a5235b9ec64b696af1b26/tools/connectors/contract.py#L51-L74
[H-mcp-auth]: https://github.com/NousResearch/hermes-agent/blob/63d0b94120027d487c9a5235b9ec64b696af1b26/tools/mcp_oauth_manager.py#L1-L99
[H-mcp-config]: https://github.com/NousResearch/hermes-agent/blob/63d0b94120027d487c9a5235b9ec64b696af1b26/tools/mcp_tool_config.py#L182-L206
[H-google]: https://github.com/NousResearch/hermes-agent/blob/63d0b94120027d487c9a5235b9ec64b696af1b26/skills/productivity/google-workspace/SKILL.md#L1-L24
[H-triage]: https://github.com/NousResearch/hermes-agent/blob/63d0b94120027d487c9a5235b9ec64b696af1b26/skills/email/email-inbox-triage/SKILL.md#L53-L97
[H-memory]: https://github.com/NousResearch/hermes-agent/blob/63d0b94120027d487c9a5235b9ec64b696af1b26/tools/memory_tool.py#L1-L101
[H-cua]: https://github.com/NousResearch/hermes-agent/blob/63d0b94120027d487c9a5235b9ec64b696af1b26/tools/computer_use/cua_backend.py#L68-L84
[R-readme]: https://github.com/morluto/rea/blob/8b181716aca2cb467be499cba226abfb5ae19141/README.md#L151-L187
[R-architecture]: https://github.com/morluto/rea/blob/8b181716aca2cb467be499cba226abfb5ae19141/docs/architecture.mermaid#L1-L70
[R-records]: https://github.com/morluto/rea/blob/8b181716aca2cb467be499cba226abfb5ae19141/src/application/investigation/InvestigationRecordPort.ts#L15-L89
[R-evidence]: https://github.com/morluto/rea/blob/8b181716aca2cb467be499cba226abfb5ae19141/src/domain/evidence.ts#L98-L169
[R-effects]: https://github.com/morluto/rea/blob/8b181716aca2cb467be499cba226abfb5ae19141/src/contracts/toolEffects.ts#L627-L688
[R-registration]: https://github.com/morluto/rea/blob/8b181716aca2cb467be499cba226abfb5ae19141/src/server/toolRegistrationOptions.ts#L17-L34
[R-resources]: https://github.com/morluto/rea/blob/8b181716aca2cb467be499cba226abfb5ae19141/src/process/ArtifactAnalysisResources.ts#L34-L129
[R-browser-secrets]: https://github.com/morluto/rea/blob/8b181716aca2cb467be499cba226abfb5ae19141/src/browser/BrowserScenarioSecrets.ts#L16-L69
[R-browser-tool]: https://github.com/morluto/rea/blob/8b181716aca2cb467be499cba226abfb5ae19141/src/server/registerBrowserScenarioTool.ts#L28-L69
[R-package]: https://github.com/morluto/rea/blob/8b181716aca2cb467be499cba226abfb5ae19141/package.json#L1-L45
[R-licenses]: https://github.com/morluto/rea/tree/8b181716aca2cb467be499cba226abfb5ae19141/licenses
[D-readme]: https://github.com/Anil-matcha/open-dots/blob/fb871a1549911981658383f994215fba9dcb3949/README.md
[D-execution]: https://github.com/Anil-matcha/open-dots/blob/fb871a1549911981658383f994215fba9dcb3949/backend/app/services/task_execution_service.py#L36-L138
[D-crypto]: https://github.com/Anil-matcha/open-dots/blob/fb871a1549911981658383f994215fba9dcb3949/backend/app/core/crypto.py#L1-L15
[D-task-model]: https://github.com/Anil-matcha/open-dots/blob/fb871a1549911981658383f994215fba9dcb3949/backend/app/db/models/task.py#L18-L52
[D-reply-tests]: https://github.com/Anil-matcha/open-dots/blob/fb871a1549911981658383f994215fba9dcb3949/backend/tests/routers/test_reply_conversation_lock.py#L52-L140
[D-permission]: https://github.com/Anil-matcha/open-dots/blob/fb871a1549911981658383f994215fba9dcb3949/backend/app/services/permission_service.py#L45-L82
[D-permission-route]: https://github.com/Anil-matcha/open-dots/blob/fb871a1549911981658383f994215fba9dcb3949/backend/app/routers/permission.py#L60-L127
[D-main]: https://github.com/Anil-matcha/open-dots/blob/fb871a1549911981658383f994215fba9dcb3949/backend/app/main.py#L13-L36
[D-scheduler]: https://github.com/Anil-matcha/open-dots/blob/fb871a1549911981658383f994215fba9dcb3949/backend/app/services/schedule_service.py#L251-L429
[D-task-route]: https://github.com/Anil-matcha/open-dots/blob/fb871a1549911981658383f994215fba9dcb3949/backend/app/routers/task.py#L21-L58
[D-api]: https://github.com/Anil-matcha/open-dots/blob/fb871a1549911981658383f994215fba9dcb3949/frontend/lib/api.ts#L26-L44
[D-schedule-tests]: https://github.com/Anil-matcha/open-dots/blob/fb871a1549911981658383f994215fba9dcb3949/backend/tests/services/test_schedule_service.py#L38-L104
[I-readme]: https://github.com/Merit-Systems/OpenInstinct/blob/0c2a7c6e842fa7105cee004b2d6ac1d5f1c7c1e8/README.md
[I-package]: https://github.com/Merit-Systems/OpenInstinct/blob/0c2a7c6e842fa7105cee004b2d6ac1d5f1c7c1e8/package.json#L1-L105
[I-schedule]: https://github.com/Merit-Systems/OpenInstinct/blob/0c2a7c6e842fa7105cee004b2d6ac1d5f1c7c1e8/agent/schedules/dynamic.ts#L15-L136
[I-schema]: https://github.com/Merit-Systems/OpenInstinct/blob/0c2a7c6e842fa7105cee004b2d6ac1d5f1c7c1e8/db/schema/schedules.ts#L106-L212
[I-job-service]: https://github.com/Merit-Systems/OpenInstinct/blob/0c2a7c6e842fa7105cee004b2d6ac1d5f1c7c1e8/db/services/scheduled-agent-jobs.ts#L184-L319
[I-agent]: https://github.com/Merit-Systems/OpenInstinct/blob/0c2a7c6e842fa7105cee004b2d6ac1d5f1c7c1e8/agent/agent.ts#L7-L32
[I-lease]: https://github.com/Merit-Systems/OpenInstinct/blob/0c2a7c6e842fa7105cee004b2d6ac1d5f1c7c1e8/db/services/scheduled-agent-run-leases.ts#L4-L19
[I-channel]: https://github.com/Merit-Systems/OpenInstinct/blob/0c2a7c6e842fa7105cee004b2d6ac1d5f1c7c1e8/agent/channels/scheduled-run.ts#L12-L124
[I-report]: https://github.com/Merit-Systems/OpenInstinct/blob/0c2a7c6e842fa7105cee004b2d6ac1d5f1c7c1e8/agent/lib/schedules/report.ts#L14-L85
[I-report-instructions]: https://github.com/Merit-Systems/OpenInstinct/blob/0c2a7c6e842fa7105cee004b2d6ac1d5f1c7c1e8/agent/instructions/content/role/scheduled-report.md#L5-L12
[I-timing]: https://github.com/Merit-Systems/OpenInstinct/blob/0c2a7c6e842fa7105cee004b2d6ac1d5f1c7c1e8/shared/schedules/timing.ts#L3-L53
[I-scope]: https://github.com/Merit-Systems/OpenInstinct/blob/0c2a7c6e842fa7105cee004b2d6ac1d5f1c7c1e8/agent/lib/principal-scope.ts#L17-L34
[I-worker-scope]: https://github.com/Merit-Systems/OpenInstinct/blob/0c2a7c6e842fa7105cee004b2d6ac1d5f1c7c1e8/agent/subagents/browser-agent/lib/access.ts#L5-L22
[I-google]: https://github.com/Merit-Systems/OpenInstinct/blob/0c2a7c6e842fa7105cee004b2d6ac1d5f1c7c1e8/agent/lib/google-workspace/client.ts#L11-L52
[I-google-scopes]: https://github.com/Merit-Systems/OpenInstinct/blob/0c2a7c6e842fa7105cee004b2d6ac1d5f1c7c1e8/shared/google-workspace/connection.ts#L3-L21
[I-gmail]: https://github.com/Merit-Systems/OpenInstinct/blob/0c2a7c6e842fa7105cee004b2d6ac1d5f1c7c1e8/agent/tools/gmail.ts#L52-L82
[I-calendar]: https://github.com/Merit-Systems/OpenInstinct/blob/0c2a7c6e842fa7105cee004b2d6ac1d5f1c7c1e8/agent/tools/calendar.ts#L39-L66
[I-google-tests]: https://github.com/Merit-Systems/OpenInstinct/blob/0c2a7c6e842fa7105cee004b2d6ac1d5f1c7c1e8/agent/lib/google-workspace/tests/google-workspace.test.ts#L15-L61
[I-run-browser]: https://github.com/Merit-Systems/OpenInstinct/blob/0c2a7c6e842fa7105cee004b2d6ac1d5f1c7c1e8/agent/tools/run_browser.ts#L5-L23
[I-browser]: https://github.com/Merit-Systems/OpenInstinct/blob/0c2a7c6e842fa7105cee004b2d6ac1d5f1c7c1e8/agent/subagents/browser-agent/tools/semantic_browser.ts#L19-L70
[I-computer]: https://github.com/Merit-Systems/OpenInstinct/blob/0c2a7c6e842fa7105cee004b2d6ac1d5f1c7c1e8/agent/subagents/browser-agent/tools/computer_action.ts#L92-L116
[I-vault]: https://github.com/Merit-Systems/OpenInstinct/blob/0c2a7c6e842fa7105cee004b2d6ac1d5f1c7c1e8/db/services/vault.ts#L173-L224
[I-fill]: https://github.com/Merit-Systems/OpenInstinct/blob/0c2a7c6e842fa7105cee004b2d6ac1d5f1c7c1e8/agent/subagents/browser-agent/tools/fill_from_vault.ts#L27-L104
[I-autofill]: https://github.com/Merit-Systems/OpenInstinct/blob/0c2a7c6e842fa7105cee004b2d6ac1d5f1c7c1e8/agent/subagents/browser-agent/lib/autofill/provider.ts#L209-L254
[I-mask]: https://github.com/Merit-Systems/OpenInstinct/blob/0c2a7c6e842fa7105cee004b2d6ac1d5f1c7c1e8/agent/subagents/browser-agent/lib/vault-screenshot-mask.ts#L3-L71
[I-workstreams]: https://github.com/Merit-Systems/OpenInstinct/blob/0c2a7c6e842fa7105cee004b2d6ac1d5f1c7c1e8/agent/memory/workstreams.ts#L25-L112
[I-workstream-service]: https://github.com/Merit-Systems/OpenInstinct/blob/0c2a7c6e842fa7105cee004b2d6ac1d5f1c7c1e8/db/services/workstreams.ts#L84-L120
[I-schedule-tests]: https://github.com/Merit-Systems/OpenInstinct/blob/0c2a7c6e842fa7105cee004b2d6ac1d5f1c7c1e8/db/tests/scheduled-agent-jobs.test.ts#L18-L81
[K-readme]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/README.md#L1-L205
[K-package]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/package.json#L1-L56
[K-worker]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/apps/worker/src/index.ts#L94-L180
[K-local-model]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/packages/adapters/src/pi-local-provider.ts#L10-L115
[K-compatible]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/packages/adapters/src/pi-openai-compatible-provider.ts#L123-L183
[K-jobs]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/packages/adapters/src/wakeup.ts#L18-L180
[K-reconcile]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/packages/adapters/src/job-reconciler.ts#L14-L97
[K-routine]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/packages/adapters/src/executor.ts#L3091-L3240
[K-schedule-tools]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/packages/adapters/src/schedule-tools.ts#L14-L35
[K-webhook]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/apps/api/src/webhook.ts#L39-L102
[K-ambient]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/apps/api/src/team-chat-bridge.ts#L797-L879
[K-judge]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/apps/api/src/team-chat-judge.ts#L89-L195
[K-silence]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/packages/adapters/src/executor.ts#L7902-L7919
[K-auth]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/apps/api/src/app.ts#L634-L663
[K-scope]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/packages/db/src/scope.ts#L19-L57
[K-schema]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/packages/db/prisma/schema.prisma#L253-L269
[K-computers]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/packages/db/src/computers.ts#L8-L49
[K-installed]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/packages/adapters/src/installed-connectors.ts#L67-L169
[K-mcp]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/packages/adapters/src/remote-mcp.ts#L23-L129
[K-secrets]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/packages/adapters/src/secrets.ts#L69-L132
[K-consent]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/apps/api/src/ai-consent.ts#L20-L108
[K-approval]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/packages/core/src/action-approval.ts#L3-L121
[K-gate]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/packages/core/src/action-approval.ts#L183-L248
[K-effect]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/packages/adapters/src/approval-effect.ts#L43-L95
[K-desktop-adapter]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/packages/adapters/src/desktop-sandbox.ts#L62-L80
[K-stack]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/apps/desktop/src/local-stack.ts#L61-L107
[K-desktop]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/apps/desktop/package.json#L1-L87
[K-permissions]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/apps/desktop/src/session-permissions.ts#L22-L89
[K-desktop-main]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/apps/desktop/src/main.ts#L217-L220
[K-mobile]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/apps/mobile/package.json#L1-L74
[K-pi-runtime]: https://github.com/elie222/rakazo/blob/0394e92c820994ec9978b046f652c3ab4ca85fa5/packages/adapters/src/pi-runtime.ts#L86-L133
