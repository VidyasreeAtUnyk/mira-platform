/**
 * POST /api/leads/[id]/suggest
 * Generates a follow-up message or upgrade proposal using OpenAI
 */

import { NextResponse, type NextRequest } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { AI_RATE_LIMIT } from '@/lib/constants';
import { formatAED } from '@/lib/utils';

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);
  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(userId, { count: 1, resetAt: now + 3600000 });
    return true;
  }
  if (entry.count >= AI_RATE_LIMIT) return false;
  entry.count += 1;
  return true;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leadId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!checkRateLimit(user.id)) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const service = createServiceClient();

  const [{ data: lead }, { data: interactions }, { data: priceIndex }] = await Promise.all([
    service.from('leads').select('*').eq('id', leadId).single(),
    service.from('interactions').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(5),
    service.from('dld_price_index').select('*').order('first_date_of_month'),
  ]);

  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const isUpgradeCandidate =
    lead.owns_property &&
    lead.owned_property_type &&
    lead.owned_purchase_year &&
    lead.owned_purchase_price;

  let upgradeContext = '';
  if (isUpgradeCandidate && priceIndex && priceIndex.length > 0) {
    const purchaseRow = priceIndex.find(
      (r: { first_date_of_month: string }) =>
        new Date(r.first_date_of_month).getFullYear() === lead.owned_purchase_year
    ) ?? priceIndex[0];
    const currentRow = priceIndex[priceIndex.length - 1];
    const indexKey =
      lead.owned_property_type === 'apartment' ? 'flat_monthly_index' : 'villa_monthly_index';
    const purchaseIndex = (purchaseRow[indexKey] ?? purchaseRow.all_monthly_index ?? 100) as number;
    const currentIndex = (currentRow[indexKey] ?? currentRow.all_monthly_index ?? 100) as number;
    const estimatedValue = lead.owned_purchase_price * (currentIndex / purchaseIndex);
    const equity = estimatedValue - lead.owned_purchase_price;
    upgradeContext = `
Upgrade opportunity data:
- Bought ${lead.owned_property_type} in ${lead.owned_property_area} in ${lead.owned_purchase_year} for ${formatAED(lead.owned_purchase_price)}
- Estimated current value: ${formatAED(estimatedValue)} (based on DLD price index)
- Estimated equity gained: ${formatAED(equity)} (${Math.round((equity / lead.owned_purchase_price) * 100)}%)
`;
  }

  const recentInteractions =
    interactions
      ?.map((i: { type: string; summary: string; outcome: string | null }) => `- ${i.type}: ${i.summary} (${i.outcome ?? 'no outcome recorded'})`)
      .join('\n') ?? 'No interactions yet';

  const suggestionType = isUpgradeCandidate ? 'upgrade_proposal' : 'followup_message';

  const prompt = isUpgradeCandidate
    ? `You are a Dubai real estate agent assistant. Write a short, friendly WhatsApp message (2-3 sentences) to ${lead.name} proposing they consider upgrading their property.
${upgradeContext}
Their current interest: ${lead.property_type ?? 'property'} in ${lead.preferred_areas?.join(', ') ?? 'Dubai'}, budget ${formatAED(lead.budget_min ?? 0)}-${formatAED(lead.budget_max ?? 0)}.
Recent interactions: ${recentInteractions}
The message should be warm, not pushy, and mention their potential equity as a conversation starter. Sign off as their agent.`
    : `You are a Dubai real estate agent assistant. Write a short, friendly WhatsApp follow-up message (2-3 sentences) to ${lead.name}.
Lead info: ${lead.lead_type}, interested in ${lead.property_type ?? 'property'} in ${lead.preferred_areas?.join(', ') ?? 'Dubai'}, budget ${formatAED(lead.budget_min ?? 0)}-${formatAED(lead.budget_max ?? 0)}.
Recent interactions: ${recentInteractions}
The message should continue the conversation naturally based on recent interactions. Keep it casual and WhatsApp-appropriate.`;

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
    });

    const content = completion.choices[0].message.content ?? '';

    const { data: suggestion } = await service
      .from('ai_suggestions')
      .insert({
        lead_id: leadId,
        suggestion_type: suggestionType,
        content,
        status: 'pending',
      })
      .select()
      .single();

    return NextResponse.json({ suggestion });
  } catch (err) {
    console.error('OpenAI suggestion error:', err);
    return NextResponse.json({ error: 'AI suggestion failed' }, { status: 500 });
  }
}
