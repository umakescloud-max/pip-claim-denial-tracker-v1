// Shared helpers for the screens (not a screen itself: App.tsx only registers *.tsx files).
import type { StatusTone } from "@kit";
import type { Claim } from "../seed";

export const SHELL = {
  brandName: "Umakes.cloud",
  brandUrl: "https://umakes.cloud",
  brandEmail: "umakescloud@gmail.com",
  personaName: "Joaquin Reyes",
  personaRole: "PI billing lead",
};

export const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export const shortDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** Calendar days from today to `d` (negative once it has passed). */
export function daysFromToday(d: Date): number {
  const a = new Date();
  a.setHours(0, 0, 0, 0);
  const b = new Date(d);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function daysLeftText(d: Date): string {
  const n = daysFromToday(d);
  if (n === 0) return "Due today";
  if (n === 1) return "1 day left";
  if (n > 1) return `${n} days left`;
  return n === -1 ? "1 day past" : `${-n} days past`;
}

export function followUpText(d: Date): string {
  const n = daysFromToday(d);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n > 1) return `In ${n} days`;
  return n === -1 ? "Overdue 1 day" : `Overdue ${-n} days`;
}

const STATUS_LABEL: Record<Claim["claim_status"], string> = {
  paid: "Paid",
  pending: "Pending",
  underpaid: "Underpaid",
  denied: "Denied",
  "records requested": "Records requested",
  "in reconsideration": "In reconsideration",
  "handed to LOP": "Handed to LOP",
};

export function claimStatusLabel(c: Claim): string {
  if (c.review) return "In review";
  return STATUS_LABEL[c.claim_status];
}

export function claimStatusTone(c: Claim): StatusTone {
  if (c.review) return "primary";
  if (["underpaid", "denied", "records requested"].includes(c.claim_status)) return "accent";
  if (c.claim_status === "paid" || c.claim_status === "in reconsideration") return "primary";
  return "muted";
}

export const OPEN_DENIAL: Claim["claim_status"][] = ["underpaid", "denied", "records requested"];

/** The nearer of a claim's appeal and timely filing deadlines that has not passed. */
export function nextDeadline(c: Claim): Date | null {
  const dates = [c.appeal_deadline, c.timely_filing_deadline].filter((d): d is Date => !!d && daysFromToday(d) >= 0);
  return dates.sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
}

export const headingStyle = { fontFamily: "var(--pf-font-heading)" };
