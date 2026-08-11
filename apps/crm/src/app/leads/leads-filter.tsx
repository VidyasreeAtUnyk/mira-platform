/**
 * LeadsFilter — client-side filter controls for leads list
 */

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LEAD_STATUSES, LEAD_TYPES } from '@/lib/constants';
import { Search } from 'lucide-react';
import { useCallback, useTransition } from 'react';

export function LeadsFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    startTransition(() => {
      router.push(`/leads?${params.toString()}`);
    });
  }

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateParam('search', e.target.value);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams]
  );

  const statusValue: string = searchParams.get('status') ?? 'all';
  const typeValue: string = searchParams.get('type') ?? 'all';

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search name or phone..."
          defaultValue={searchParams.get('search') ?? ''}
          onChange={handleSearch}
          className="pl-8"
        />
      </div>
      <Select
        value={statusValue}
        onValueChange={(v) => updateParam('status', v ?? '')}
      >
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {LEAD_STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={typeValue}
        onValueChange={(v) => updateParam('type', v ?? '')}
      >
        <SelectTrigger className="w-full sm:w-36">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {LEAD_TYPES.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
