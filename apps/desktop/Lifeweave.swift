import AppKit
import WebKit
import Foundation
import Darwin

// No JavaScript message handlers, Node bridge, external browser opener, or file URL loader.
struct LocalOrigin {
    let port: Int
    var url: URL { URL(string: "http://127.0.0.1:\(port)")! }

    init?(readyURL: String) {
        guard let parts = URLComponents(string: readyURL), parts.scheme == "http",
              parts.host == "127.0.0.1", let port = parts.port, (1...65535).contains(port),
              parts.user == nil, parts.password == nil, parts.query == nil,
              parts.fragment == nil, parts.path.isEmpty || parts.path == "/" else { return nil }
        self.port = port
    }

    func allows(_ candidate: URL?) -> Bool {
        guard let candidate, let parts = URLComponents(url: candidate, resolvingAgainstBaseURL: false)
        else { return false }
        return parts.scheme == "http" && parts.host == "127.0.0.1" && parts.port == port
            && parts.user == nil && parts.password == nil
    }

    var resourceRules: String {
        // A resource-level rule also blocks remote requests that are not navigations.
        let rules: [[String: Any]] = [
            ["trigger": ["url-filter": ".*"], "action": ["type": "block"]],
            ["trigger": ["url-filter": "^http://127\\.0\\.0\\.1:\(port)/"],
             "action": ["type": "ignore-previous-rules"]]
        ]
        return String(data: try! JSONSerialization.data(withJSONObject: rules), encoding: .utf8)!
    }
}

@MainActor
final class LifeweaveApp: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
    private var window: NSWindow?
    private var webView: WKWebView?
    private var child: Process?
    private var origin: LocalOrigin?
    private var dataDirectory: URL?
    private var timeout: DispatchWorkItem?
    private var stopping = false
    private let smoke = CommandLine.arguments.contains("--smoke-test")

    func applicationDidFinishLaunching(_ notification: Notification) {
        if smoke { NSApp.setActivationPolicy(.prohibited) }
        else { createWindow(); createMenu() }
        do { try startServer() }
        catch { fail("The local workspace could not start. Rebuild the app and check the Node runtime.") }
    }

    private func createWindow() {
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1240, height: 860),
                              styleMask: [.titled, .closable, .miniaturizable, .resizable],
                              backing: .buffered, defer: false)
        window.title = "Lifeweave"
        window.minSize = NSSize(width: 820, height: 560)
        window.center()
        let label = NSTextField(labelWithString: "Starting your local workspace…")
        label.font = .systemFont(ofSize: 18, weight: .medium)
        label.translatesAutoresizingMaskIntoConstraints = false
        window.contentView?.addSubview(label)
        if let view = window.contentView {
            NSLayoutConstraint.activate([label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
                                         label.centerYAnchor.constraint(equalTo: view.centerYAnchor)])
        }
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        self.window = window
    }

    private func createMenu() {
        let menu = NSMenu()
        let appItem = NSMenuItem(); menu.addItem(appItem)
        let appMenu = NSMenu(title: "Lifeweave"); appItem.submenu = appMenu
        appMenu.addItem(withTitle: "About Lifeweave", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit Lifeweave", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let editItem = NSMenuItem(); menu.addItem(editItem)
        let edit = NSMenu(title: "Edit"); editItem.submenu = edit
        for (title, selector, key) in [("Undo", "undo:", "z"), ("Cut", "cut:", "x"),
                                      ("Copy", "copy:", "c"), ("Paste", "paste:", "v"),
                                      ("Select All", "selectAll:", "a")] {
            edit.addItem(withTitle: title, action: NSSelectorFromString(selector), keyEquivalent: key)
        }
        let viewItem = NSMenuItem(); menu.addItem(viewItem)
        let view = NSMenu(title: "View"); viewItem.submenu = view
        let reload = NSMenuItem(title: "Reload Workspace", action: #selector(reloadWorkspace), keyEquivalent: "r")
        reload.target = self; view.addItem(reload)
        NSApp.mainMenu = menu
    }

    @objc private func reloadWorkspace() {
        guard let origin else { return }
        webView?.load(URLRequest(url: origin.url))
    }

    private func startServer() throws {
        guard let resources = Bundle.main.resourceURL else { throw CocoaError(.fileNoSuchFile) }
        let node = resources.appendingPathComponent("runtime/node")
        let site = resources.appendingPathComponent("site", isDirectory: true)
        let server = site.appendingPathComponent("apps/web/server.mjs")
        guard FileManager.default.isExecutableFile(atPath: node.path),
              FileManager.default.fileExists(atPath: server.path) else { throw CocoaError(.fileNoSuchFile) }
        let storage: URL
        if let override = ProcessInfo.processInfo.environment["LIFEWEAVE_DATA_DIR"], !override.isEmpty {
            guard override.hasPrefix("/") else { throw CocoaError(.fileReadInvalidFileName) }
            storage = URL(fileURLWithPath: override, isDirectory: true)
        } else {
            storage = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                                 appropriateFor: nil, create: true)
                .appendingPathComponent("Lifeweave", isDirectory: true)
        }
        try FileManager.default.createDirectory(at: storage, withIntermediateDirectories: true,
                                                attributes: [.posixPermissions: 0o700])
        dataDirectory = storage
        let process = Process()
        process.executableURL = node; process.arguments = [server.path]
        process.currentDirectoryURL = site
        // Never inherit NODE_OPTIONS, provider credentials, proxies, shell settings, or tokens.
        process.environment = ["PATH": "/usr/bin:/bin:/usr/sbin:/sbin", "LANG": "en_US.UTF-8",
                               "LIFEWEAVE_PORT": "0", "LIFEWEAVE_DATA_DIR": storage.path,
                               "LIFEWEAVE_PARENT_PID": String(getpid())]
        // Explicit presentation configuration only; the backend validates loopback URL and bounds.
        for key in ["LIFEWEAVE_MODEL", "LIFEWEAVE_MODEL_ENDPOINT", "LIFEWEAVE_MODEL_MAX_REQUESTS", "LIFEWEAVE_MODEL_TIMEOUT_MS"] {
            if let value = ProcessInfo.processInfo.environment[key], value.utf8.count <= 512 {
                process.environment?[key] = value
            }
        }
        let output = Pipe(); let errors = Pipe()
        process.standardOutput = output; process.standardError = errors
        process.terminationHandler = { [weak self] _ in
            DispatchQueue.main.async {
                guard let self, !self.stopping else { return }
                self.fail("The local workspace stopped. Close and reopen Lifeweave.")
            }
        }
        child = process
        try process.run()
        let reader = output.fileHandleForReading
        DispatchQueue.global(qos: .utility).async { [weak self] in
            var pending = Data()
            while true {
                let chunk = reader.availableData
                if chunk.isEmpty { break }
                pending.append(chunk)
                if pending.count > 32768 { pending.removeAll(); continue }
                while let newline = pending.firstIndex(of: 10) {
                    let line = Data(pending[..<newline]); pending.removeSubrange(...newline)
                    guard line.count <= 8192 else { continue }
                    DispatchQueue.main.async { self?.consumeReady(line) }
                }
            }
        }
        // Drain stderr without putting future private records into logs or UI error strings.
        let errorReader = errors.fileHandleForReading
        DispatchQueue.global(qos: .utility).async { while !errorReader.availableData.isEmpty {} }
        let timeout = DispatchWorkItem { [weak self] in
            guard let self, self.origin == nil else { return }
            self.fail("The local workspace did not become ready within 20 seconds.")
        }
        self.timeout = timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + 20, execute: timeout)
    }

    private func consumeReady(_ line: Data) {
        guard origin == nil, let record = try? JSONSerialization.jsonObject(with: line) as? [String: Any],
              record["event"] as? String == "lifeweave.ready",
              let url = record["url"] as? String, let origin = LocalOrigin(readyURL: url) else { return }
        self.origin = origin; timeout?.cancel()
        if smoke { smokeHTTP(origin); return }
        installBrowser(origin)
    }

    private func installBrowser(_ origin: LocalOrigin) {
        guard let storage = dataDirectory else { fail("Local storage is unavailable."); return }
        let rulesURL = storage.appendingPathComponent("WebKitRules", isDirectory: true)
        do { try FileManager.default.createDirectory(at: rulesURL, withIntermediateDirectories: true,
                                                    attributes: [.posixPermissions: 0o700]) }
        catch { fail("Local browser rules could not be prepared."); return }
        guard let rules = WKContentRuleListStore(url: rulesURL) else {
            fail("Local browser rules could not be opened."); return
        }
        rules.compileContentRuleList(forIdentifier: "LifeweaveLocalOnly", encodedContentRuleList: origin.resourceRules) {
            [weak self] ruleList, error in
            guard let self else { return }
            guard error == nil, let ruleList else { self.fail("Local browser rules could not be compiled."); return }
            let configuration = WKWebViewConfiguration()
            configuration.websiteDataStore = .nonPersistent()
            configuration.userContentController.add(ruleList)
            configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
            configuration.allowsAirPlayForMediaPlayback = false
            let webView = WKWebView(frame: .zero, configuration: configuration)
            webView.navigationDelegate = self; webView.uiDelegate = self
            webView.allowsBackForwardNavigationGestures = false
            self.webView = webView; self.window?.contentView = webView
            webView.load(URLRequest(url: origin.url))
        }
    }

    private func smokeHTTP(_ origin: LocalOrigin) {
        let session = URLSession(configuration: .ephemeral)
        var request = URLRequest(url: origin.url); request.timeoutInterval = 10
        session.dataTask(with: request) { [weak self] data, response, error in
            let code = (response as? HTTPURLResponse)?.statusCode
            let body = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
            DispatchQueue.main.async {
                guard let self else { return }
                guard error == nil && code == 200 && body.lowercased().contains("<!doctype html>") else {
                    self.finishSmoke(false, detail: "Packaged backend did not return local HTML"); return
                }
                self.installBrowser(origin)
                let timeout = DispatchWorkItem { [weak self] in
                    self?.finishSmoke(false, detail: "Native WebKit render did not complete within 20 seconds")
                }
                self.timeout = timeout
                DispatchQueue.main.asyncAfter(deadline: .now() + 20, execute: timeout)
            }
            session.finishTasksAndInvalidate()
        }.resume()
    }

    private func finishSmoke(_ passed: Bool, detail: String) {
        let record: [String: Any] = ["event": "lifeweave.desktop.smoke", "passed": passed,
                                    "detail": detail, "url": origin?.url.absoluteString ?? "",
                                    "childPID": child?.processIdentifier ?? 0,
                                    "isolatedDataOverride": ProcessInfo.processInfo.environment["LIFEWEAVE_DATA_DIR"] != nil]
        let data = try! JSONSerialization.data(withJSONObject: record, options: [.sortedKeys])
        print(String(data: data, encoding: .utf8)!); fflush(stdout)
        stopServer(); exit(passed ? 0 : 1)
    }

    private func fail(_ message: String) {
        timeout?.cancel()
        if smoke { finishSmoke(false, detail: message); return }
        stopServer()
        let alert = NSAlert(); alert.messageText = "Lifeweave could not open"; alert.informativeText = message
        alert.addButton(withTitle: "Quit"); alert.runModal(); NSApp.terminate(nil)
    }

    private func stopServer() {
        stopping = true; timeout?.cancel(); webView?.stopLoading()
        guard let child, child.isRunning else { return }
        child.terminate()
        let deadline = Date().addingTimeInterval(1.5)
        while child.isRunning && Date() < deadline { usleep(20_000) }
        if child.isRunning { kill(child.processIdentifier, SIGKILL) }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationWillTerminate(_ notification: Notification) { stopServer() }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if smoke { checkRenderedWorkspace(attempt: 0) }
    }

    private func checkRenderedWorkspace(attempt: Int) {
        guard smoke, let webView, origin?.allows(webView.url) == true else { return }
        // A fixed DOM predicate in test mode; no user-supplied scripts or native bridge.
        webView.evaluateJavaScript("Boolean(document.querySelector('#app .shell') && document.querySelector('#workspace-choice') && document.querySelectorAll('.daily-board .board-move').length === 3 && document.querySelectorAll('.assistant-composer form input').length === 1 && document.querySelector('.workspace-menu') && !document.querySelector('.workspace-menu').open)") {
            [weak self] value, error in
            guard let self else { return }
            if error == nil && value as? Bool == true {
                self.finishSmoke(true, detail: "Bundled backend, local content rules, and native WKWebView rendered the synthetic workspace")
            } else if attempt < 40 {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { self.checkRenderedWorkspace(attempt: attempt + 1) }
            } else {
                self.finishSmoke(false, detail: "Native WKWebView did not render the workspace controls")
            }
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if smoke { finishSmoke(false, detail: "Native WKWebView could not load the loopback workspace") }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        decisionHandler(navigationAction.targetFrame != nil && origin?.allows(navigationAction.request.url) == true ? .allow : .cancel)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        decisionHandler(origin?.allows(navigationResponse.response.url) == true && navigationResponse.canShowMIMEType ? .allow : .cancel)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? { nil }

    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        completionHandler(nil)
    }

    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) { decisionHandler(.deny) }
}

@main
enum LifeweaveLauncher {
    @MainActor
    static func main() {
        if CommandLine.arguments.contains("--self-test") {
            let boundary = LocalOrigin(readyURL: "http://127.0.0.1:4318")!
            let good = ["http://127.0.0.1:4318/", "http://127.0.0.1:4318/api/state?workspace=demo", "http://127.0.0.1:4318/#goals"]
            let bad = ["https://example.com", "file:///etc/passwd", "http://localhost:4318/", "http://127.0.0.1:4319/",
                       "http://127.0.0.1:4318.evil.example/", "http://user@127.0.0.1:4318/", "javascript:alert(1)", "data:text/html,test"]
            let badReadiness = ["http://127.0.0.1:0", "https://127.0.0.1:4318", "http://localhost:4318", "http://127.0.0.1:4318/a",
                                "http://127.0.0.1:4318?token=test", "http://user@127.0.0.1:4318"]
            let passed = good.allSatisfy { boundary.allows(URL(string: $0)) }
                && bad.allSatisfy { !boundary.allows(URL(string: $0)) }
                && badReadiness.allSatisfy { LocalOrigin(readyURL: $0) == nil }
            print("{\"event\":\"lifeweave.desktop.boundary\",\"passed\":\(passed),\"cases\":\(good.count + bad.count + badReadiness.count)}")
            exit(passed ? 0 : 1)
        }
        
        let app = NSApplication.shared
        let delegate = LifeweaveApp()
        app.delegate = delegate
        app.setActivationPolicy(.regular)
        app.run()
    }
}
