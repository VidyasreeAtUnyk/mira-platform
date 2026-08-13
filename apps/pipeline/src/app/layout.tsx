import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mira | Pipeline & Listings",
  description: "Transaction pipeline and listing management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Plain <a>, not next/link's Link -- NOT auto-prefixed by basePath
            (see next.config.ts), so the /pipeline prefix is written out by
            hand here rather than relying on Next to add it. Board now lives
            at this app's own root (was a sub-route + redirect, see
            src/app/page.tsx's header comment for why that broke under
            Multi-Zones). */}
        <nav className="flex gap-4 border-b border-neutral-200 px-6 py-3 text-sm dark:border-neutral-800">
          <a href="/pipeline" className="font-medium hover:underline">
            Pipeline
          </a>
          <a href="/pipeline/listings" className="font-medium hover:underline">
            Listings
          </a>
        </nav>
        <main className="p-6">{children}</main>
      </body>
    </html>
  );
}
