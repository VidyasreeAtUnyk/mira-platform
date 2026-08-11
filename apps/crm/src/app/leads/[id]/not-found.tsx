/**
 * 404 for lead not found
 */

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function LeadNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center px-4">
      <h1 className="text-xl font-bold">Lead not found</h1>
      <p className="text-muted-foreground text-sm">
        This lead doesn&apos;t exist or you don&apos;t have access to it.
      </p>
      <Link href="/leads">
        <Button variant="outline">Back to Leads</Button>
      </Link>
    </div>
  );
}
