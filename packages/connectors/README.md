# LifeWeave connectors

Read-only provider normalization with explicit tenant, connector and goal mapping. No token is acquired, stored or sent to a model. `createGraphReader` accepts a host token and exposes two fixed GET endpoints, refuses redirects and bounds its calendar window. It has been tested with injected provider mocks, not a live account. Pagination, OAuth token lifecycle, provider verification, durable encrypted credentials, rate limits and production acceptance remain work to do.

Raw messages normalize to `mail.message`; they cannot turn themselves into an authorized commitment. A host/user must confirm extracted commitment fields before emitting `mail.commitment`. Health exports describe measurements, never diagnosis. Importing normalized observations still requires `@lifeweave/core` consent, scope, tenant and freshness validation.

`emitAgUiSurface` emits a custom AG-UI-shaped state event into a host sink. It does not claim a verified CopilotKit/OpenUI runtime integration. See the exported integration catalog for implemented, mock-tested and planned status.
