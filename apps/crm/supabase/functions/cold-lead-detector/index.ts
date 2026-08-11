/**
 * Supabase Edge Function: cold-lead-detector
 * Runs daily at 8am UAE time (4am UTC)
 * Calls the Next.js API route to flag cold leads
 *
 * Deploy: supabase functions deploy cold-lead-detector
 * Schedule: supabase functions schedule cold-lead-detector --schedule "0 4 * * *"
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (_req) => {
  const appUrl = Deno.env.get('APP_URL');
  const cronSecret = Deno.env.get('CRON_SECRET');

  if (!appUrl || !cronSecret) {
    return new Response(JSON.stringify({ error: 'Missing APP_URL or CRON_SECRET' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const response = await fetch(`${appUrl}/api/leads/cold-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret,
      },
    });

    const result = await response.json();

    console.log(`Cold lead detector ran: ${JSON.stringify(result)}`);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Cold lead detector error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
