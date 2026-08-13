/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    serverComponentsExternalPackages: ['typescript', 'tsx']
  },
  // Baseline response headers -- applied to every route. CORS is handled separately per-request
  // in middleware.ts (src/lib/cors.ts), since it needs to react to the request's Origin header,
  // which static config here cannot do.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
  webpack: (config, { dev }) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs']
    };
    if (dev) {
      config.cache = { type: 'memory' };
    }
    return config;
  }
};

export default nextConfig;
