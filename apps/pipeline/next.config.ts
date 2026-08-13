/**
 * Next.js configuration with security headers.
 * Mirrors apps/crm/next.config.ts's headers (same conventions across the
 * monorepo's Next.js apps); connect-src is scoped down since this app has
 * no Supabase/OpenAI calls (see PROGRESS-pipeline.md Notes for why this app
 * uses a plain Postgres connection instead of Supabase).
 */

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Next.js Multi-Zones: this app is served under /pipeline by the root
  // zone (apps/dashboard), which proxies matching requests here via
  // rewrites in its own next.config.ts. basePath makes every internal
  // Link/asset reference in this app resolve under that prefix
  // automatically -- see PROGRESS-integration.md for the cross-app
  // navigation decision writeup.
  basePath: '/pipeline',
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
