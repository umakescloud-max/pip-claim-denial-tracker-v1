// Shared by the claim screens: the seed claims merged with what the visitor changed.
// Everything the visitor changes lives in useDemoState, so it survives a reload and
// Reset clears it. Timestamps are stored as numbers (never ISO strings).
import { useMemo } from "react";
import { businessDaysBetween, useDemo, useDemoState, type StatusTone } from "@kit";
import {
  adjusterContacts,
  claims as seedClaims,
  EDGE_CASE_ID,
  reviewQueueSeed,
  type AdjusterContact,
  type Claim,
  type ClaimStatus,
  type ReviewItem,
} from "../seed";

export const SHELL = {
  brandName: "Umakes.cloud",
  brandUrl: "https://umakes.cloud",
  brandEmail: "umakescloud@gmail.com",
  personaName: "Joaquin Reyes",
  personaRole: "PI billing lead",
};

export const LOGIN_KEY = "pf-login-pip-claim-denial-tracker-v1";

export function isLoggedIn(): boolean {
  try {
    return window.localStorage.getItem(LOGIN_KEY) === "1";
  } catch {
    return false;
  }
}

interface ClaimChange {
  claim_status?: ClaimStatus;
  payment_history_attached?: boolean;
}

export interface AddedContact {
  id: string;
  claim_id: string;
  at: number;
  contact_by: string;
  channel: string;
  outcome: string;
  next_action_at: number | null;
}

export type LiveClaim = Claim & { payment_history_attached: boolean; in_review: boolean };

export function useClaims() {
  const { completed } = useDemo();
  const [changes, setChanges] = useDemoState<Record<string, ClaimChange>>("claim-changes", {});
  const [queue, setQueue] = useDemoState<ReviewItem[]>("review-queue", reviewQueueSeed);
  const [added, setAdded] = useDemoState<AddedContact[]>("added-contacts", []);

  const byId = useMemo(() => {
    const queued = new Set(queue.map((q) => q.claim_id));
    const map = new Map<string, LiveClaim>();
    for (const c of seedClaims) {
      const ch = changes[c.claim_id] ?? {};
      map.set(c.claim_id, {
        ...c,
        claim_status: ch.claim_status ?? c.claim_status,
        // Using the sample payment history on Denials matches it to claim 5208 too.
        payment_history_attached:
          !!ch.payment_history_attached || (c.claim_id === EDGE_CASE_ID && completed.has("attach-payment-history")),
        in_review: queued.has(c.claim_id),
      });
    }
    return map;
  }, [changes, queue, completed]);

  const claims = useMemo(() => seedClaims.map((c) => byId.get(c.claim_id)!), [byId]);

  const update = (id: string, change: ClaimChange) =>
    setChanges((prev) => ({ ...prev, [id]: { ...prev[id], ...change } }));

  const addContact = (contact: Omit<AddedContact, "id">) =>
    setAdded((prev) => [...prev, { ...contact, id: `added-${contact.claim_id}-${contact.at}-${prev.length}` }]);

  return { claims, byId, queue, setQueue, update, added, addContact };
}

export function contactsFor(claimId: string, added: AddedContact[]): AdjusterContact[] {
  return [
    ...adjusterContacts.filter((c) => c.claim_id === claimId),
    ...added
      .filter((c) => c.claim_id === claimId)
      .map((c) => ({
        id: c.id,
        claim_id: c.claim_id,
        contact_date: new Date(c.at),
        contact_by: c.contact_by,
        channel: c.channel,
        outcome: c.outcome,
        next_action_date: c.next_action_at === null ? null : new Date(c.next_action_at),
      })),
  ];
}

export const money = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export const STATUS_TONE: Record<ClaimStatus, StatusTone> = {
  Paid: "primary",
  Pending: "muted",
  Underpaid: "accent",
  Denied: "accent",
  "Records requested": "accent",
  "In reconsideration": "primary",
  "Handed to LOP": "muted",
};

/** Business days left to a deadline, in words. */
export function countdown(deadline: Date | null): string {
  if (!deadline) return "No deadline";
  const days = businessDaysBetween(new Date(), deadline);
  if (days < 0) return "Past the deadline";
  if (days === 0) return "Due today";
  return days === 1 ? "1 business day left" : `${days} business days left`;
}

/** Calendar days from the start of today, used for "in the next 7 days". */
export function calendarDaysUntil(d: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  return Math.round((day.getTime() - today.getTime()) / 86_400_000);
}
