'use client';

import { useState } from 'react';
import { ArrowRight, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/');
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[oklch(0.17_0.04_255)] flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-white">M</span>
          </div>
          <span className="font-semibold text-white text-sm tracking-wide">Mira Trackers</span>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-white leading-tight">
              Track the days.<br />
              Hit the targets.
            </h1>
            <p className="text-[oklch(0.70_0.05_255)] text-lg leading-relaxed">
              Individual and team goals, logged daily, with streaks and progress-to-target at a glance.
            </p>
          </div>

          <div className="space-y-3">
            {[
              'Revenue, activity, and custom metrics',
              'Daily/weekly/monthly/quarterly cadence',
              'Team-wide and per-agent visibility',
            ].map((f) => (
              <div key={f} className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                <span className="text-[oklch(0.80_0.03_255)] text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[oklch(0.40_0.02_255)] text-xs">© 2026 Mira · Dubai, UAE</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-xs font-bold text-white">M</span>
            </div>
            <span className="font-semibold text-sm">Mira Trackers</span>
          </div>

          {!supabaseConfigured ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Dev mode</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  No live Supabase project is configured (<code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code> is
                  unset), so sign-in is bypassed — every request is treated as{' '}
                  <code className="text-xs">DEV_AGENT_ID</code>. This only happens in local dev/test; see{' '}
                  <code className="text-xs">src/lib/current-agent.ts</code>.
                </p>
              </div>
              <Button onClick={() => router.push('/')} className="w-full">
                Continue to app
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Enter your credentials to access your workspace
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
                )}

                <Button type="submit" disabled={loading || !email || !password} className="w-full">
                  {loading ? (
                    <span className="inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <p className="text-center text-xs text-muted-foreground">Contact your manager if you need access.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
