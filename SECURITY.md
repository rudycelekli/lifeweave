# Security boundaries

This alpha is a single-user loopback application. Do not expose the host to a public network or use it as an enterprise multi-user service. Its JSON state and local drafts are plaintext, protected by restrictive filesystem permissions and the user's device boundary; at-rest encryption is not implemented.

Documents, mail, provider responses, model output and tool descriptions are data. They cannot activate goals, change tenant, grant scopes, approve actions or register executable UI. The core rechecks consent, scope, source freshness and tenant on every evaluation. UI text is inserted as text. External actions are declarations only and remain disabled in the default renderer.

The server allows only its exact loopback host and origin, requires a same-site session plus CSRF token for mutation, bounds JSON inputs and serves a finite public asset surface with canonical-path containment. The native shell allows its own exact local origin, blocks external resources/navigation and uses no native command bridge. These measures do not establish protection from a malicious local process, a compromised device, arbitrary future plugins or a production multi-tenant threat model.

Never put access tokens in state, browser storage, prompts, URLs or logs. The Graph reader accepts a host token, performs fixed HTTPS GET requests, refuses redirects and returns normalized data. Live token lifecycle, provider-specific OAuth security and credential vaults remain implementation/acceptance work. Browser and computer-use runtimes need explicit per-action authority in an isolated process; sandboxing one terminal does not contain host Python, MCP tools or plugins.

Private sources, historical extracts, project memory and runtime state are excluded from release archives by an explicit allowlist. The release verifier checks known private names/path patterns and scans for key/token shapes. That scan is useful evidence, not a proof that arbitrary secrets can never exist in source. Inspect every new integration before publication.

Report potential vulnerabilities privately through the repository's security reporting facility when available. Do not include credentials or personal source data in public issues. No security contact mailbox is invented for this project.
