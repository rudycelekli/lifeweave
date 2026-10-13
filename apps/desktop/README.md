# Lifeweave macOS desktop

The open-source shell uses AppKit and WKWebView. It starts its own packaged Node backend on an ephemeral loopback port, consumes the backend's readiness JSON, and opens that exact origin. The backend's local evaluator runs while the desktop process is alive. Closing the last window or quitting terminates the shell's child. The server also supports a parent-PID watchdog for abnormal shell termination.

There is no JavaScript-to-native message bridge or renderer Node integration. Navigation is restricted to the exact child-server origin. WebKit content rules block other resource origins; popup windows, file uploads, media capture, and file URLs are denied. Cookies and browser storage use a nonpersistent WebKit store. Existing provider connectors remain disconnected until implemented and authorized. This does not make the process sandboxed or prove absence of every WebKit or backend vulnerability.

Normal launches persist workflow state in `~/Library/Application Support/Lifeweave`. This path belongs to the current macOS user and is created with mode 0700. Override `LIFEWEAVE_DATA_DIR` with an absolute path for isolated tests. The renderer cannot browse that directory. The smoke check below uses a fresh test directory, never the supplied personal source extracts.

Build from the repository root on macOS with Xcode Command Line Tools, a compatible local Node executable (22+), and that executable's matching Node license notices:

```sh
node scripts/build-desktop.mjs --node /absolute/path/to/node --node-license /absolute/path/to/Node-LICENSE
```

For the bundled runtime used in this local build, the matching complete Node v24.19.0 license is retained under `vendor/node-v24.19.0-LICENSE`. It was retrieved from the [official versioned Node source](https://github.com/nodejs/node/blob/v24.19.0/LICENSE). Node contains several third-party components; retain the full notice file, not only its top MIT paragraph. The build manifest pins the executable and license hashes. To use a different Node version, supply its matching license and review the distribution artifact. A build without a supplied license requires `--local-qa-only` and receives an explicit distribution gate.

The output is `dist/desktop/Lifeweave.app`. The builder copies a finite list of ten web/server assets, only `src/`, `package.json`, `README.md`, and optional `LICENSE` from core/UI/connectors/planner packages, the public comparison JSON, and root license notices when present. Generated verification records, TAP output, and package scripts are excluded. It never copies `.private`, document extracts, personal candidates, runtime state, dependencies, environment files, or Git metadata. Imported source symlinks are rejected. The builder creates verified internal links for `@lifeweave/core` and `@lifeweave/planner`, each pointing only at the copied public package. It bundles the supplied Node executable without other runtime tools or packages.

No model is configured by default. An explicit terminal launch can forward only `LIFEWEAVE_MODEL`, `LIFEWEAVE_MODEL_ENDPOINT`, `LIFEWEAVE_MODEL_MAX_REQUESTS` and `LIFEWEAVE_MODEL_TIMEOUT_MS`; the backend validates their loopback URL and request/time bounds. The browser cannot change them. Provider credentials, proxy variables, `NODE_OPTIONS` and unrelated host environment remain excluded. A loopback model service can itself forward to cloud inference, so its execution policy needs separate configuration and acceptance.

```sh
dist/desktop/Lifeweave.app/Contents/MacOS/Lifeweave --self-test
LIFEWEAVE_DATA_DIR="$PWD/.private/desktop-smoke" dist/desktop/Lifeweave.app/Contents/MacOS/Lifeweave --smoke-test
open dist/desktop/Lifeweave.app
```

`--self-test` checks origin/readiness rejection cases without starting a server. `--smoke-test` starts the actual bundled backend, requires a successful local HTML response, compiles the content rules, checks that native WKWebView renders the synthetic workspace controls, reports a JSON receipt, and stops its own child. It does not replace an interactive visual or accessibility check.

This is a local macOS app build. The artifact uses an ad-hoc signature for local QA and is not Developer ID signed, notarized, App Store accepted, auto-updating, or a universal binary. The supplied Node runtime requires macOS 13.5; the builder reads its Mach-O minimum and records the full app minimum instead of assuming the Swift target covers the runtime. Distribution needs a reviewed runtime provenance/license inventory, target architecture build, current security testing, release receipt, Developer ID signing/notarization, and an update/rollback policy. Windows/Linux shells, mobile companions, hosted sync, paid capabilities, and business integrations remain separate work. No account credentials are packaged.

API references: [WKContentRuleListStore](https://developer.apple.com/documentation/webkit/wkcontentruleliststore), [file-upload delegate](https://developer.apple.com/documentation/webkit/wkuidelegate/webview(_:runopenpanelwith:initiatedbyframe:completionhandler:)).
