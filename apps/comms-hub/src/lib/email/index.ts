import type { EmailProvider } from '@/types';
import type { EmailAdapter } from './types';
import { MockEmailAdapter } from './mock-adapter';

export * from './types';
export { MockEmailAdapter };

/** Adapter factory -- see ../bsp/index.ts's getWhatsAppAdapter for the same pattern. */
export function getEmailAdapter(provider: EmailProvider = 'mock'): EmailAdapter {
  switch (provider) {
    case 'mock':
      return new MockEmailAdapter();
    case 'gmail':
    case 'outlook':
      throw new Error(
        `Email provider '${provider}' has no adapter implementation yet -- no live OAuth credentials exist in this repo. Implement a class satisfying EmailAdapter and wire it in here once real access exists.`
      );
    default: {
      const exhaustive: never = provider;
      throw new Error(`Unknown email provider: ${exhaustive}`);
    }
  }
}
