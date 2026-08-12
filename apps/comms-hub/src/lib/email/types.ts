import type { EmailProvider } from '@/types';

export interface OutboundEmailMessage {
  threadId: string;
  to: string;
  subject: string;
  body: string;
}

export interface InboundEmailWebhookEvent {
  from: string;
  subject: string;
  body: string;
  providerMessageId: string;
  receivedAt: string;
}

export interface EmailSendResult {
  /** Same draft-and-hold guarantee as WhatsAppSendResult -- see ../bsp/types.ts. */
  status: 'held' | 'failed';
  providerMessageId: string | null;
  reason: string;
}

/**
 * Provider-agnostic email integration surface (SPEC.md module 6: "Unified
 * inbox: email (Gmail/Outlook API)"). Kept symmetric with WhatsAppAdapter
 * (../bsp/types.ts) so both channels share the same call-site shape in the
 * unified inbox even though the underlying providers are unrelated.
 */
export interface EmailAdapter {
  readonly provider: EmailProvider;
  send(message: OutboundEmailMessage): Promise<EmailSendResult>;
  parseWebhook(payload: unknown): InboundEmailWebhookEvent;
}
