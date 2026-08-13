/**
 * Next.js configuration with security headers -- mirrors apps/crm's config
 * (same CSP shape) minus the domains comms-hub doesn't call. No Supabase/
 * OpenAI connect-src entries yet since this build doesn't wire up a live
 * database or AI calls -- see PROGRESS-comms.md.
 */

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Next.js Multi-Zones: served under /comms by the root zone
  // (apps/dashboard) -- see apps/pipeline/next.config.ts's comment for the
  // full explanation, same setup here. (Path is /comms, matching
  // apps/dashboard/src/lib/roles.ts's existing ModuleKey "comms".)
  basePath: '/comms',
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
