import type { EmailAdapter, EmailSendResult, InboundEmailWebhookEvent, OutboundEmailMessage } from './types';

/**
 * The only EmailAdapter implementation wired up in this build. A real
 * Gmail or Outlook adapter would implement `EmailAdapter` and call that
 * provider's API from `send()` -- neither exists here since no OAuth
 * credentials exist in this repo. `send()` performs no network I/O and
 * always resolves to `status: 'held'`.
 */
export class MockEmailAdapter implements EmailAdapter {
  readonly provider = 'mock' as const;

  async send(message: OutboundEmailMessage): Promise<EmailSendResult> {
    return {
      status: 'held',
      providerMessageId: null,
      reason: `No live email provider configured (EMAIL_PROVIDER unset) -- message for thread ${message.threadId} held for manual approval, not sent.`,
    };
  }

  parseWebhook(payload: unknown): InboundEmailWebhookEvent {
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('from' in payload) ||
      !('body' in payload) ||
      !('subject' in payload)
    ) {
      throw new Error('MockEmailAdapter.parseWebhook: payload missing required "from"/"subject"/"body" fields');
    }
    const p = payload as { from: unknown; subject: unknown; body: unknown; id?: unknown };
    return {
      from: String(p.from),
      subject: String(p.subject),
      body: String(p.body),
      providerMessageId: p.id ? String(p.id) : `mock-${Date.now()}`,
      receivedAt: new Date().toISOString(),
    };
  }
}
