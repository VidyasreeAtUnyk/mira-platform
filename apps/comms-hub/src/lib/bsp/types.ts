import type { BspProvider } from '@/types';

export interface OutboundWhatsAppMessage {
  threadId: string;
  /** E.164 phone number. */
  to: string;
  body: string;
}

export interface InboundWhatsAppWebhookEvent {
  /** E.164 phone number. */
  from: string;
  body: string;
  providerMessageId: string;
  receivedAt: string;
}

export interface WhatsAppSendResult {
  /**
   * Every adapter in this build resolves to 'held' or 'failed' -- never
   * 'sent'. Draft-and-hold (CLAUDE.md: "Never touch production data or
   * send anything live... without it going through the review/approval
   * queue design") is enforced here in the type itself, not left to
   * callers to remember. There is no live BSP credential anywhere in this
   * repo by design (see .env.example), so nothing CAN be delivered yet.
   */
  status: 'held' | 'failed';
  providerMessageId: string | null;
  reason: string;
}

/**
 * BSP-agnostic WhatsApp integration surface (SPEC.md module 6: "no direct
 * Meta approval needed -- integrate via a BSP (Business Solution Provider):
 * Interakt..., Wati, or Twilio"). Any of the three plugs in behind this
 * interface; nothing else in comms-hub should import a provider-specific
 * SDK or type directly -- always go through `WhatsAppAdapter` /
 * `getWhatsAppAdapter()` (see ./index.ts).
 */
export interface WhatsAppAdapter {
  readonly provider: BspProvider;
  send(message: OutboundWhatsAppMessage): Promise<WhatsAppSendResult>;
  parseWebhook(payload: unknown): InboundWhatsAppWebhookEvent;
}
