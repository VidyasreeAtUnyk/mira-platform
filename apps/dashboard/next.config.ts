/**
 * Next.js configuration with security headers -- mirrors apps/crm's
 * next.config.ts. `connect-src` has no Supabase/OpenAI hosts since this app
 * doesn't call either yet (it reads the shared Postgres database directly
 * from server components; see src/lib/db.ts).
 */
import type { NextConfig } from 'next';

/**
 * Next.js Multi-Zones: this app is the root zone (default domain, no
 * basePath) -- every other module (apps/pipeline, apps/trackers,
 * apps/social-assistant, apps/comms-hub) is its own independently built/
 * deployed Next.js app with its own basePath, proxied here via rewrites so
 * the whole thing appears as one product under one origin. Each zone's
 * origin comes from an env var (not hardcoded) so dev (localhost ports)
 * and a real deployment (separate hosts/URLs) can differ without a code
 * change -- unset in .env.local, that module's nav item stays unlinked
 * rather than rewriting to nothing. See PROGRESS-integration.md for the
 * full decision writeup, and each other app's own next.config.ts for the
 * basePath side of this setup.
 */
const ZONE_ORIGINS = {
  pipeline: process.env.PIPELINE_ZONE_URL,
  trackers: process.env.TRACKERS_ZONE_URL,
  social: process.env.SOCIAL_ZONE_URL,
  comms: process.env.COMMS_ZONE_URL,
} as const;

const nextConfig: NextConfig = {
  async rewrites() {
    const rules: { source: string; destination: string }[] = [];
    for (const [zone, origin] of Object.entries(ZONE_ORIGINS)) {
      if (!origin) continue;
      // Static assets (Next's own /_next/*) and the app's actual pages both
      // need a rule -- basePath only prefixes the app's own routes, not
      // where its dev/build assets are served from underneath that prefix.
      rules.push({ source: `/${zone}/_next/:path*`, destination: `${origin}/${zone}/_next/:path*` });
      rules.push({ source: `/${zone}`, destination: `${origin}/${zone}` });
      rules.push({ source: `/${zone}/:path*`, destination: `${origin}/${zone}/:path*` });
    }
    return rules;
  },
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
