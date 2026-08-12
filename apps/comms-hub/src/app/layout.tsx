/**
 * Root layout -- wraps all pages in the demo store (client-side, in-memory --
 * see src/components/comms-store.tsx) and the persistent header/nav/role
 * switcher.
 */
import type { Metadata } from 'next';
import './globals.css';
import { CommsStoreProvider } from '@/components/comms-store';
import { Header } from '@/components/header';

export const metadata: Metadata = {
  title: 'Mira Comms Hub',
  description: 'Unified email/WhatsApp inbox — draft-and-hold, role-filtered, demo data only.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased">
        <CommsStoreProvider>
          <Header />
          <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
        </CommsStoreProvider>
      </body>
    </html>
  );
}
