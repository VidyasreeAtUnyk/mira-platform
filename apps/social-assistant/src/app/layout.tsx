import type { Metadata } from 'next';
import { Nav } from '@/components/nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'MIRA Agam — Social Assistant',
  description: 'Content calendar, poster generation, and performance monitoring (draft-and-hold).',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-brand-bg text-brand-body antialiased">
        <Nav />
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
