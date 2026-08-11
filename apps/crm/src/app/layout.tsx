/**
 * Root layout — wraps all pages, sets metadata and fonts
 */

import type { Metadata } from 'next';
import { Inter, Geist } from 'next/font/google';
import './globals.css';
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RealEstateIntel',
  description: 'AI-powered real estate CRM and market intelligence for Dubai',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("h-full", geist.variable)}>
      <body className={`${inter.className} h-full antialiased`}>{children}</body>
    </html>
  );
}
