import { clsx } from 'clsx';
import type { PostStatus } from '@/types/social';

const STATUS_STYLES: Record<PostStatus, string> = {
  draft: 'bg-brand-body/10 text-brand-body/80 border-brand-body/30',
  pending_approval: 'bg-brand-gold/15 text-brand-gold-light border-brand-gold/50',
  approved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  held: 'bg-red-500/10 text-red-300 border-red-500/40',
};

const STATUS_LABELS: Record<PostStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending approval',
  approved: 'Approved',
  held: 'Held',
};

export function StatusBadge({ status }: { status: PostStatus }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide',
        STATUS_STYLES[status]
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border border-brand-hairline px-2.5 py-0.5 text-xs text-brand-body/70',
        className
      )}
    >
      {children}
    </span>
  );
}
