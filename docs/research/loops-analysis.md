# Loops AI: lessons for LifeWeave

Reviewed 2026-10-13 against the existing LifeWeave alpha2. Scope: public homepage, four workflow states, product examples, expanded FAQ answers, A101 case study and data-usage policy. The website is rendered in JavaScript; its visible DOM was inspected because the basic web reader exposed almost no content. Firecrawl CLI was not available on PATH. Five local source captures and their hashes are retained in the ignored private research folder. No account, demo request, customer dataset, purchase or inference was accessed.

## Decision

Use Loops as a product and workflow reference. The strongest transferable idea is one coherent context shared by focused capabilities, with outcomes feeding subsequent decisions. Its commerce offering also informs a future SMB capability pack. This review does not establish an open-source component to adopt, the architecture of its backend, or its real operating permissions. No code or proprietary visual assets were copied, and no LifeWeave runtime behavior changed in this research task.

## Observed patterns and proposed applications

| Public Loops pattern | LifeWeave application | Current state / next work |
| --- | --- | --- |
| A shared semantic layer supports multiple products. | Maintain consistent goals, people, commitments, measurements, time constraints and source permissions across capabilities. A relationship or commitment should keep its identity when it appears in mail, a calendar and a dashboard. | Typed goals and evidence already exist. Entity reconciliation and richer shared context remain future work. Shared context must remain purpose-scoped; personal health records do not become business telemetry. |
| Natural-language search exposes the interpreted occasion, budget and constraints before showing product results. | An explicit request such as “I have 30 minutes before my meeting; help with my learning goal” can produce an inspectable intent brief and a bounded focus interface. Surface the understood goal and constraints; ask one question when a missing answer changes the decision. | Current frames and calculators provide the renderer. The model adapter only proposes presentation changes; semantic request compilation and reliable clarification are not implemented. |
| Catalog enrichment supplies information used by search and assistants. | Treat missing due dates, measurements, baselines and goal mappings as context-quality issues. Offer a small, timely correction request when its answer would unlock a useful recommendation. | The engine preserves unknown values. Add explicit context gaps and user-confirmed corrections; inferred facts stay candidates with provenance. |
| Customer interactions identify weak product information, completing the feedback cycle. | Link an observation to its proposal, local draft or authorized action, and later measurement. Use feedback to assess usefulness, interruption burden and real progress. | Feedback, deliveries, drafts and measurements exist, but there is no longitudinal outcome-learning or causal attribution system. A handled suggestion remains separate from an achieved result. |
| One conversation and product context can continue across website, app and messaging channels. | Keep a consistent task and goal state as the person moves between desktop, phone and connected channels. Each channel can open an appropriate surface for the same task. | Web and local macOS shell exist. Authenticated device handoff, encrypted sync, native mobile and channel connectors are not implemented. |
| Customers can start with one product and later add capabilities. | Activate one chosen goal, one consented source and one useful workflow before expanding the workspace. A strong first workflow is calendar-aware focus planning and explicit commitment review. | Local onboarding exists; the first live read-only email/calendar connection still requires provider setup and acceptance. |

The shared-layer and feedback descriptions come from the [homepage workflow](https://loopsai.com/). The intent, enrichment and channel examples appear on the [product page](https://loopsai.com/#/products). LifeWeave applications in this table are proposed design decisions, not claims that Loops implements a personal assistant or that these changes improve user outcomes.

## Evaluation lesson

Loops' [FAQ](https://loopsai.com/#/faq) says pilots compare against a current experience and control group, with commerce outcome measures. LifeWeave should retain that baseline discipline: compare a new intervention to the existing deterministic assistant using a frozen evaluation contract, then qualify actual usefulness with consented users.

Track recommendation usefulness, verified goal measurements, time saved, interruption burden, oversight and total cost. Keep the context available at decision time and the later result as separate evidence. A click, saved draft or improvement after a suggestion cannot by itself establish that the suggestion caused the result.

The [A101 case study](https://loopsai.com/#/case-studies/a101) reports higher conversion and growing use. These are vendor-reported figures. The reviewed public material does not provide enough detail about sample sizes, assignment, exclusions and uncertainty to independently reproduce or attribute those results. The FAQ's general control-group claim does not resolve the methods for this particular study. Do not import its numerical uplift into LifeWeave forecasts.

## Personal and commercial alignment

Loops describes commerce ranking and assistance aligned with revenue and margin on its [product page](https://loopsai.com/#/products). That is relevant to an explicitly configured merchant workspace. Personal LifeWeave ranking should follow the person's chosen goals, constraints and consent. Paid connector or affiliate incentives must not silently alter personal recommendations.

A later commerce pack can share the public contracts while adding a catalog, customer commitments, inventory, product-information gaps and approved business outcome measures. Its initial workflow could be customer question -> grounded product answer draft -> owner approval where needed -> observed resolution. Website, marketing and management packs can follow qualified demand. The personal interface does not need retail-specific capabilities to benefit from the shared-context architecture.

The [data-usage policy](https://loopsai.com/#/data-usage) distinguishes customer content and third-party model training authorization, while describing other processing and improvement uses. This is a useful reminder to publish purpose-specific controls for each connection and learning path. It is a vendor policy statement, not independent verification of its implementation. LifeWeave should keep retrieval, inferred facts, evaluation records and optional training distinct, and preserve user-controlled export and revocation.

## Recommended next build order

1. **Complete one live read-only source path.** Bounded intake, explicit mappings, freshness, revocation and connect/read/revoke canaries must work end to end.
2. **Add context gaps and an intent brief.** Ask only for information that changes the next action; retain source-backed facts and explicit user corrections separately from hypotheses.
3. **Add an outcome ledger.** Connect proposal, draft/action receipt and later measurement without awarding progress from feedback or claiming causal credit.
4. **Add authenticated channel handoff.** Reuse the same task identity and owner-controlled context when mobile or communications connectors are qualified.
5. **Qualify a narrow SMB pack.** Use merchant goals and data in an isolated business workspace with its own authority and evidence requirements.

The existing dashboard-first direction remains appropriate. The highest-value extension is a coherent, measurable feedback cycle around useful surfaces, rather than an immediate expansion into many unqualified integrations.
