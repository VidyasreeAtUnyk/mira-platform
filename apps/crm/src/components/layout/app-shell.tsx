/**
 * App shell — wraps all authenticated pages with sidebar + bottom nav
 */

import { Sidebar } from './sidebar';
import { BottomNav } from './bottom-nav';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="md:pl-64">
        <div className="pb-nav px-4 py-6 md:px-8">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
