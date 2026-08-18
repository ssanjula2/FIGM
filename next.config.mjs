/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    serverComponentsExternalPackages: ['typescript', 'tsx'],
    // P0 security fix (audit finding CRIT-DYNPROF): src/engine/sandbox/profiler-sandbox-runner.cjs
    // is spawned at runtime via a plain string path (child_process.spawnSync), never `import`ed, so
    // Next's static file-tracing cannot discover it on its own and would otherwise omit it from a
    // production/serverless build output -- silently breaking the sandbox (and, worse, inviting a
    // "just fall back to in-process eval" fix later). This forces it to always ship.
    outputFileTracingIncludes: {
      '/api/**/*': ['./src/engine/sandbox/profiler-sandbox-runner.cjs'],
    },
  },
  // Baseline response headers -- applied to every route. CORS is handled separately per-request
  // in middleware.ts (src/lib/cors.ts), since it needs to react to the request's Origin header,
  // which static config here cannot do.
  //
  // PROD-01: adds a Content-Security-Policy, Strict-Transport-Security, and Permissions-Policy.
  // Built from the app's actual dependencies, not a generically copied template -- the only
  // third-party origin this app loads client-side resources from is cdn.jsdelivr.net, Monaco
  // Editor's default script/style/font/worker host (confirmed via
  // node_modules/@monaco-editor/loader's own config: `vs: 'https://cdn.jsdelivr.net/npm/monaco-
  // editor@.../min/vs'`). Everything else (images, the Gemini AI calls in src/ai/gemini-service.ts)
  // is same-origin or server-side-only, confirmed by reading every external-resource call site,
  // not assumed.
  //
  // script-src keeps 'unsafe-inline': Next.js App Router injects its own inline hydration-data
  // scripts, and this codebase's entire UI is built on inline `style={{...}}` JSX props throughout
  // (thousands of call sites) rather than a CSS-in-JS/nonce pipeline -- a strict nonce-based
  // script-src is the more "correct" long-term answer (see Next.js's own documented middleware-
  // nonce pattern) but requires per-request nonce plumbing through middleware.ts, which is
  // deliberately out of scope for this pass to avoid touching that file's existing, security-
  // sensitive auth-redirect matcher/logic. Documented tradeoff, not a silent gap: this CSP still
  // provides real protection via a restrictive default-src, object-src 'none', frame-ancestors
  // 'none' (defense-in-depth alongside X-Frame-Options above), base-uri 'self', and a precisely
  // scoped connect-src/img-src/font-src/worker-src allow-list instead of leaving them wide open.
  //
  // 'unsafe-eval' and the extra HMR websocket allowance are DEV-ONLY (webpack's dev-mode eval-based
  // source maps and the Fast Refresh websocket both need it) -- never shipped in production.
  async headers() {
    const isDev = process.env.NODE_ENV !== 'production';
    const scriptSrc = `script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net${isDev ? " 'unsafe-eval'" : ''}`;
    const connectSrc = `connect-src 'self' https://cdn.jsdelivr.net${isDev ? ' ws://localhost:* ws://127.0.0.1:*' : ''}`;
    const csp = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "img-src 'self' data: blob:",
      "font-src 'self' data: https://cdn.jsdelivr.net",
      connectSrc,
      "worker-src 'self' blob: https://cdn.jsdelivr.net",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
        ],
      },
    ];
  },
  webpack: (config, { dev, isServer }) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs']
    };
    if (dev) {
      config.cache = { type: 'memory' };
    }
    // src/engine/dynamic-profiler.ts is reachable from the CLIENT bundle (app/live-scan/page.tsx
    // dynamically imports RemediationEngine -> RuleExecutionEngine -> DynamicProfiler), but its
    // server-only sandboxed-execution path (see that file's own header comment, CRIT-DYNPROF)
    // lazily requires real Node built-ins guarded behind a `typeof window === 'undefined'` check.
    // That runtime guard alone is not enough: webpack's module parser still statically discovers
    // and tries to resolve every require() call regardless of the surrounding branch (dead-code
    // elimination only runs during production minification, not `next dev`, and even then happens
    // after module resolution) -- so without this, the client compile fails outright with
    // "Module not found: Can't resolve 'child_process'" the moment /live-scan is visited, and
    // because Next dev shares one client compilation across every route, that failure poisons
    // every other page too until the dev server restarts. Stubbing these to `false` for the client
    // compiler only (never the server one) tells webpack to resolve them to an empty module instead
    // of erroring; the runtime guard above ensures the resulting empty stubs are never actually
    // called in a browser context.
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        child_process: false,
        fs: false,
        path: false,
        url: false,
      };
    }
    return config;
  }
};

export default nextConfig;
