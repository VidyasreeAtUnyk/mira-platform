/**
 * Root layout. RESOLVED (was wrapping everything in a client-side,
 * in-memory demo store -- src/components/comms-store.tsx, since deleted,
 * see PROGRESS-integration.md): every page now reads real Postgres data
 * directly, no provider needed.
 */
import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/header';

export const metadata: Metadata = {
  title: 'Mira Comms Hub',
  description: 'Unified email/WhatsApp inbox — draft-and-hold, role-filtered.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased">
        <Header />
        <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
