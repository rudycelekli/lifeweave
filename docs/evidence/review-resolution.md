# Independent review resolution

The independent review found eight concrete integration defects. All eight were addressed in the local alpha:

| Finding | Resolution | Evidence |
| --- | --- | --- |
| R1 Provider IDs violate core identifier grammar | SHA-256 source identifiers with connector prefix, no lossy truncation | Realistic Graph ID composition test |
| R2 Provider summaries exceed core bound | Summaries capped at 2,000 characters | Provider/core composition test |
| R3 Calendar-date rollover | Explicit timezone and calendar day validation | Impossible-date and missing-timezone negative controls |
| R4 Health scope reduction retains raw data | Local health observations purged when scope is removed | Durable local API test |
| R5 Async workspace race | Captured workspace/request generation, stale response rejection, mutation workspace guard | API isolation tests plus observed rapid personal/business switch |
| R6 Delivery dedup ignores day/snooze | UI receipt key includes workspace, local day and feedback epoch | Core durable-budget/snooze controls and UI source review |
| R7 Static path surface too broad | Finite web assets, package module allowlist, canonical-path and data-directory checks | Private/server-path API negative controls |
| R8 AG-UI emitter accepts invalid frames | Validate SurfaceFrame before emitting copied state | Event-sink invalid-frame and copy tests |

Additional release checks found a bootstrap module-linking order issue and a desktop package-root receipt leak. Startup now dynamically imports the server after linking local packages; a fresh source snapshot starts without dependency installation. Desktop packages are copied from an explicit runtime subset. These fixes do not establish production multi-user, OAuth or signed distribution readiness.
