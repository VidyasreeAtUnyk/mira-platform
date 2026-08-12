import chalk from "chalk";
import type { MouUrgency } from "../domain/mou.js";

export function colorUrgency(urgency: MouUrgency): string {
  if (urgency === "overdue") return chalk.red(urgency);
  if (urgency === "expiring_soon") return chalk.yellow(urgency);
  if (urgency === "not_yet_active") return chalk.cyan(urgency);
  if (urgency === "closed") return chalk.gray(urgency);
  return chalk.green(urgency); // in_force
}

export function formatMoney(amount: number | null, currency: string): string {
  if (amount === null) return chalk.dim("--");
  return `${currency} ${amount.toLocaleString()}`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return chalk.dim("--");
  return new Date(iso).toLocaleDateString();
}

export function truncate(text: string, max = 60): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
