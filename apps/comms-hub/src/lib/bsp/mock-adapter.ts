import type { InboundWhatsAppWebhookEvent, OutboundWhatsAppMessage, WhatsAppAdapter, WhatsAppSendResult } from './types';

/**
 * The only WhatsAppAdapter implementation wired up in this build. A real
 * Interakt/Wati/Twilio adapter would implement the same `WhatsAppAdapter`
 * interface and call that provider's API from `send()` -- none exist here
 * because no live BSP credentials exist in this repo, and per CLAUDE.md
 * none should be invented ("if you need one that doesn't exist, use an env
 * var, note the gap in Blockers"). `send()` performs no network I/O; it
 * always resolves to `status: 'held'` so drafts stay in the approval
 * queue, matching draft-and-hold by construction rather than convention.
 */
export class MockWhatsAppAdapter implements WhatsAppAdapter {
  readonly provider = 'mock' as const;

  async send(message: OutboundWhatsAppMessage): Promise<WhatsAppSendResult> {
    return {
      status: 'held',
      providerMessageId: null,
      reason: `No live BSP configured (WHATSAPP_BSP_PROVIDER unset) -- message for thread ${message.threadId} held for manual approval, not sent.`,
    };
  }

  parseWebhook(payload: unknown): InboundWhatsAppWebhookEvent {
    if (typeof payload !== 'object' || payload === null || !('from' in payload) || !('body' in payload)) {
      throw new Error('MockWhatsAppAdapter.parseWebhook: payload missing required "from"/"body" fields');
    }
    const p = payload as { from: unknown; body: unknown; id?: unknown };
    return {
      from: String(p.from),
      body: String(p.body),
      providerMessageId: p.id ? String(p.id) : `mock-${Date.now()}`,
      receivedAt: new Date().toISOString(),
    };
  }
}
