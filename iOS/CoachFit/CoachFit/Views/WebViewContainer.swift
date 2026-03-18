import SwiftUI
import WebKit

struct WebViewContainer: View {
    let url: URL
    let sessionToken: String?
    @Environment(\.dismiss) private var dismiss

    @State private var loadingProgress: Double = 0
    @State private var isLoading = true
    @State private var webView: WKWebView?

    var body: some View {
        NavigationStack {
            ZStack(alignment: .top) {
                WebView(
                    url: url,
                    sessionToken: sessionToken,
                    loadingProgress: $loadingProgress,
                    isLoading: $isLoading,
                    onWebViewCreated: { webView = $0 }
                )

                if isLoading {
                    ProgressView(value: loadingProgress)
                        .progressViewStyle(.linear)
                        .tint(.accentColor)
                }
            }
            .overlay {
                if isLoading && loadingProgress < 0.1 {
                    ProgressView("Loading...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(.ultraThinMaterial)
                }
            }
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }

                ToolbarItemGroup(placement: .bottomBar) {
                    ShareLink(item: url)

                    Spacer()

                    Button {
                        webView?.reload()
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
        }
    }
}

// MARK: - WebView (UIViewRepresentable)

private struct WebView: UIViewRepresentable {
    let url: URL
    let sessionToken: String?
    @Binding var loadingProgress: Double
    @Binding var isLoading: Bool
    let onWebViewCreated: (WKWebView) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true

        context.coordinator.progressObservation = webView.observe(
            \.estimatedProgress,
            options: [.new]
        ) { _, change in
            Task { @MainActor in
                loadingProgress = change.newValue ?? 0
            }
        }

        context.coordinator.loadingObservation = webView.observe(
            \.isLoading,
            options: [.new]
        ) { _, change in
            Task { @MainActor in
                isLoading = change.newValue ?? false
            }
        }

        onWebViewCreated(webView)

        injectSessionCookieThenLoad(webView: webView)

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        // No dynamic updates needed; URL is loaded once on creation.
    }

    private func injectSessionCookieThenLoad(webView: WKWebView) {
        guard let token = sessionToken, !token.isEmpty else {
            webView.load(URLRequest(url: url))
            return
        }

        var properties: [HTTPCookiePropertyKey: Any] = [
            .name: "__session",
            .value: token,
            .domain: ".gcgyms.com",
            .path: "/",
            .secure: true,
        ]

        // Set expiry to 1 hour from now (matches typical Clerk session lifetime).
        properties[.expires] = Date(timeIntervalSinceNow: 3600)

        guard let cookie = HTTPCookie(properties: properties) else {
            webView.load(URLRequest(url: url))
            return
        }

        webView.configuration.websiteDataStore.httpCookieStore.setCookie(cookie) {
            webView.load(URLRequest(url: url))
        }
    }
}

// MARK: - Coordinator

extension WebView {
    final class Coordinator: NSObject, WKNavigationDelegate {
        let parent: WebView
        var progressObservation: NSKeyValueObservation?
        var loadingObservation: NSKeyValueObservation?

        init(parent: WebView) {
            self.parent = parent
        }

        // MARK: Navigation Policy

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let requestURL = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }

            // Allow all navigations within gcgyms.com.
            if let host = requestURL.host?.lowercased(),
               host == "gcgyms.com" || host.hasSuffix(".gcgyms.com") {
                decisionHandler(.allow)
                return
            }

            // For user-tapped links to external domains, open in Safari.
            if navigationAction.navigationType == .linkActivated {
                UIApplication.shared.open(requestURL)
                decisionHandler(.cancel)
                return
            }

            // Allow non-link navigations (redirects, form submissions, etc.)
            decisionHandler(.allow)
        }
    }
}

// MARK: - Preview

#Preview {
    WebViewContainer(
        url: URL(string: "https://gcgyms.com/client-dashboard")!,
        sessionToken: nil
    )
}
