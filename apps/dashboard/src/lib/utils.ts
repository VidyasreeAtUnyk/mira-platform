/**
 * Shared utility functions -- mirrors apps/crm's src/lib/utils.ts (cn() +
 * date helpers), trimmed to what the Today view actually uses.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeAgo(dateString: string | null): string {
  if (!dateString) return "Never contacted";
  return formatDistanceToNow(parseISO(dateString), { addSuffix: true });
}

/** Title-case a snake_case stage/type value for display, e.g. "viewing_scheduled" -> "Viewing Scheduled". */
export function titleCase(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
