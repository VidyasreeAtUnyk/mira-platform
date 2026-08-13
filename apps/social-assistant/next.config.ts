/**
 * Next.js configuration with security headers (mirrors apps/crm's config —
 * no OpenAI/external image-gen connect-src since this module doesn't call
 * one; see PROGRESS-social.md Notes for why poster generation is local SVG
 * templating instead).
 */

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Next.js Multi-Zones: served under /social by the root zone
  // (apps/dashboard) -- see apps/pipeline/next.config.ts's comment for the
  // full explanation, same setup here. (Path is /social, not
  // /social-assistant, to match apps/dashboard/src/lib/roles.ts's existing
  // ModuleKey "social".)
  basePath: '/social',
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
              "img-src 'self' data: blob: https:",
              "font-src 'self'",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
