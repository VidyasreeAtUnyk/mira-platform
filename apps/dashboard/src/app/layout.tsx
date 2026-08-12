/**
 * Root layout -- wraps all pages, sets metadata and fonts.
 * Mirrors apps/crm's src/app/layout.tsx.
 */
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Mira -- Today",
  description: "Mira COO Agent -- Today view",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("h-full", geist.variable)}>
      <body className={cn(geist.className, "h-full antialiased")}>{children}</body>
    </html>
  );
}
