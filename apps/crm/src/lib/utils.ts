/**
 * Shared utility functions
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, differenceInDays, parseISO } from 'date-fns';

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format AED currency */
export function formatAED(amount: number): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format budget range */
export function formatBudget(min: number | null, max: number | null): string {
  if (!min && !max) return 'Budget not specified';
  if (!min) return `Up to ${formatAED(max!)}`;
  if (!max) return `From ${formatAED(min)}`;
  return `${formatAED(min)} – ${formatAED(max)}`;
}

/** Days since a date string */
export function daysSince(dateString: string | null): number | null {
  if (!dateString) return null;
  return differenceInDays(new Date(), parseISO(dateString));
}

/** Whether a lead is cold (no contact in 7+ days) */
export function isColdLead(lastContactedAt: string | null): boolean {
  const days = daysSince(lastContactedAt);
  return days !== null && days >= 7;
}

/** Human-readable time since date */
export function timeAgo(dateString: string | null): string {
  if (!dateString) return 'Never contacted';
  return formatDistanceToNow(parseISO(dateString), { addSuffix: true });
}

/** Capitalize first letter */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Format lead status for display */
export function formatStatus(status: string): string {
  const map: Record<string, string> = {
    new: 'New',
    contacted: 'Contacted',
    interested: 'Interested',
    viewing: 'Viewing',
    offer: 'Offer',
    closed_won: 'Closed Won',
    closed_lost: 'Closed Lost',
  };
  return map[status] ?? capitalize(status);
}

/** Status badge color classes */
export function statusColor(status: string): string {
  const map: Record<string, string> = {
    new: 'bg-blue-100 text-blue-800',
    contacted: 'bg-yellow-100 text-yellow-800',
    interested: 'bg-purple-100 text-purple-800',
    viewing: 'bg-orange-100 text-orange-800',
    offer: 'bg-pink-100 text-pink-800',
    closed_won: 'bg-green-100 text-green-800',
    closed_lost: 'bg-gray-100 text-gray-500',
  };
  return map[status] ?? 'bg-gray-100 text-gray-800';
}

/** AI score color */
export function scoreColor(score: number): string {
  if (score >= 8) return 'text-green-600';
  if (score >= 5) return 'text-yellow-600';
  return 'text-red-600';
}

/** Format phone number for WhatsApp link */
export function whatsappLink(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  return `https://wa.me/${cleaned}`;
}
