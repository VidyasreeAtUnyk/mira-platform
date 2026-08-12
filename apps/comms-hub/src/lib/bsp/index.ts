import type { BspProvider } from '@/types';
import type { WhatsAppAdapter } from './types';
import { MockWhatsAppAdapter } from './mock-adapter';

export * from './types';
export { MockWhatsAppAdapter };

/**
 * Adapter factory. Swap in a real Interakt/Wati/Twilio adapter class here
 * once credentials exist (see .env.example's WHATSAPP_BSP_PROVIDER). Only
 * 'mock' is implemented in this build; the others throw explicitly rather
 * than silently falling back, so a missing integration fails loudly instead
 * of pretending to work.
 */
export function getWhatsAppAdapter(provider: BspProvider = 'mock'): WhatsAppAdapter {
  switch (provider) {
    case 'mock':
      return new MockWhatsAppAdapter();
    case 'interakt':
    case 'wati':
    case 'twilio':
      throw new Error(
        `WhatsApp BSP provider '${provider}' has no adapter implementation yet -- no live credentials exist in this repo (CLAUDE.md forbids inventing them). Implement a class satisfying WhatsAppAdapter and wire it in here once real BSP access exists.`
      );
    default: {
      const exhaustive: never = provider;
      throw new Error(`Unknown WhatsApp BSP provider: ${exhaustive}`);
    }
  }
}
