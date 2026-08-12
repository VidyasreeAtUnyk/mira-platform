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
        <nav className="flex gap-4 border-b border-neutral-200 px-6 py-3 text-sm dark:border-neutral-800">
          <a href="/pipeline" className="font-medium hover:underline">
            Pipeline
          </a>
          <a href="/listings" className="font-medium hover:underline">
            Listings
          </a>
        </nav>
        <main className="p-6">{children}</main>
      </body>
    </html>
  );
}
