/**
 * Root layout — wraps all pages, sets metadata.
 * Uses the system font stack (no next/font/google) rather than apps/crm's
 * Geist/Inter Google Fonts, to avoid a build-time network fetch this
 * sandbox's proxy may not reach -- same brand tokens either way.
 */

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mira Trackers',
  description: 'Days/goals tracking for Mira agents — individual and team progress-to-target.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
