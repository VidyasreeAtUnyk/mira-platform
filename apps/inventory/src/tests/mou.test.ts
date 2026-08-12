import type { Test } from "./testHelpers.js";
import { assertEqual } from "./testHelpers.js";
import { mouUrgency } from "../domain/mou.js";

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export const mouTests: Test[] = [
  {
    name: "mouUrgency: an active term past its end date is overdue",
    run: () => {
      const urgency = mouUrgency({ term_start: daysAgo(400), term_end: daysAgo(1), status: "active" });
      assertEqual(urgency, "overdue", "past-end-date active term should be overdue");
    },
  },
  {
    name: "mouUrgency: status='expired' is overdue even if term_end happens to be in the future",
    run: () => {
      const urgency = mouUrgency({ term_start: daysAgo(10), term_end: daysFromNow(5), status: "expired" });
      assertEqual(urgency, "overdue", "explicit 'expired' status should always read as overdue");
    },
  },
  {
    name: "mouUrgency: a term ending within the configured window is expiring_soon",
    run: () => {
      const urgency = mouUrgency({ term_start: daysAgo(300), term_end: daysFromNow(30), status: "active" });
      assertEqual(urgency, "expiring_soon", "30 days out is within the default 60-day window");
    },
  },
  {
    name: "mouUrgency: a term ending well beyond the window is in_force",
    run: () => {
      const urgency = mouUrgency({ term_start: daysAgo(10), term_end: daysFromNow(200), status: "active" });
      assertEqual(urgency, "in_force", "200 days out is outside the default 60-day window");
    },
  },
  {
    name: "mouUrgency: a term whose start date is still in the future is not_yet_active",
    run: () => {
      const urgency = mouUrgency({ term_start: daysFromNow(15), term_end: daysFromNow(380), status: "draft" });
      assertEqual(urgency, "not_yet_active", "future term_start should read as not_yet_active");
    },
  },
  {
    name: "mouUrgency: terminated status is closed regardless of dates",
    run: () => {
      const urgency = mouUrgency({ term_start: daysAgo(400), term_end: daysAgo(1), status: "terminated" });
      assertEqual(urgency, "closed", "terminated should always be closed, even with a past end date");
    },
  },
  {
    name: "mouUrgency: renewed status is closed regardless of dates",
    run: () => {
      const urgency = mouUrgency({ term_start: daysAgo(400), term_end: daysFromNow(5), status: "renewed" });
      assertEqual(urgency, "closed", "renewed should always be closed");
    },
  },
  {
    name: "mouUrgency: a term ending exactly today counts as expiring_soon, not overdue",
    run: () => {
      const urgency = mouUrgency({ term_start: daysAgo(10), term_end: daysFromNow(0), status: "active" });
      assertEqual(urgency, "expiring_soon", "term ending today should not yet be overdue");
    },
  },
];
