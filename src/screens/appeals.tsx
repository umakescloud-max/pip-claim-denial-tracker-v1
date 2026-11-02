import { useState } from "react";
import { AppShell, ApprovalQueue, AuditLog, DocumentViewer, TourRunner, formatDate, useActivity, type ApprovalItem } from "@kit";
import { NAV } from "../nav";
import tour from "../tour.json";
import { CPT_LABELS, EDGE_CASE_ID, REASONS, type ReviewItem } from "../seed";
import { contactsFor, isLoggedIn, money, SHELL, useClaims, type AddedContact, type LiveClaim } from "./claimState";

function reconsiderationLetter(c: LiveClaim): string[] {
  const opening = `To the claims adjuster at ${c.carrier}:`;
  const re = `Re: claim ${c.claim_number}, patient ${c.patient_name}, date of loss ${formatDate(c.date_of_loss)}`;
  const services = `${c.visits} ${c.visits === 1 ? "visit" : "visits"} (${c.cpt_codes.map((code) => CPT_LABELS[code].toLowerCase()).join(", ")})`;
  const notice = c.eob_date ? formatDate(c.eob_date) : "recently";
  let body: string[];
  if (c.claim_id === EDGE_CASE_ID) {
    body = [
      `Your notice dated ${notice} denies payment of ${money(c.billed_amount)} for ${c.visits} physical therapy visits on the grounds that PIP benefits are exhausted.`,
      `Your own payment history on this claim shows ${money(c.benefits_paid_to_date)} paid against a ${money(c.benefit_limit)} benefit limit, leaving ${money(c.benefit_limit - c.benefits_paid_to_date)}.`,
      `We ask that you reconsider the denial and pay the billed visits from the remaining benefit.`,
      c.payment_history_attached
        ? "Attached: your payment history on this claim, the itemized bill and the treating records."
        : "Attached: the itemized bill and the treating records. Your payment history is not attached yet.",
    ];
  } else if (c.denial_reason === REASONS.underpaid) {
    body = [
      `Your EOB dated ${notice} paid ${money(c.paid_amount)} of ${money(c.billed_amount)} billed for ${services}, below the fee schedule.`,
      `We ask that you reconsider and pay the remaining ${money(c.billed_amount - c.paid_amount)}.`,
      "Attached: the itemized bill and the fee schedule amounts for each code.",
    ];
  } else if (c.denial_reason === REASONS.records) {
    body = [
      `Your notice dated ${notice} asks for the treating records for ${services}.`,
      `The records are attached. We ask that you process the ${money(c.billed_amount)} billed.`,
    ];
  } else {
    body = [
      `Your notice dated ${notice} denies ${money(c.billed_amount)} for ${services}: ${c.denial_reason?.toLowerCase()}.`,
      "The corrected claim is attached. We ask that you reprocess it.",
    ];
  }
  return [re, opening, ...body, "Joaquin Reyes, PI billing lead, Larkfield Injury & Spine Group"];
}

function handoffSummary(c: LiveClaim, added: AddedContact[]): string[] {
  const contacts = contactsFor(c.claim_id, added);
  return [
    "To Marcus Odum, lien and LOP coordinator",
    `Claim ${c.claim_id}, ${c.patient_name}, ${c.carrier}, claim ${c.claim_number}`,
    `Referring firm: ${c.referring_firm}`,
    `Benefits used: ${money(c.benefits_paid_to_date)} of the ${money(c.benefit_limit)} limit`,
    `Balance to move to the letter of protection: ${money(c.billed_amount - c.paid_amount)}`,
    `History attached: submitted ${c.submitted_date ? formatDate(c.submitted_date) : "not yet"}, carrier notice ${c.eob_date ? formatDate(c.eob_date) : "not yet"}, ${contacts.length} adjuster ${contacts.length === 1 ? "contact" : "contacts"}`,
  ];
}

export default function Appeals() {
  const { logAction } = useActivity();
  const { byId, queue, setQueue, update, added, addContact } = useClaims();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const entries = queue.map((q) => ({ q, c: byId.get(q.claim_id)! })).filter((e) => e.c);
  const items: ApprovalItem[] = entries.map(({ q, c }) => ({
    id: c.claim_id,
    title:
      q.kind === "reconsideration"
        ? `Claim ${c.claim_id}: reconsideration to ${c.carrier}`
        : `Claim ${c.claim_id}: hand ${money(c.billed_amount - c.paid_amount)} to the LOP coordinator`,
    subtitle: `${c.patient_name}, ${c.denial_reason}. Benefits used ${money(c.benefits_paid_to_date)} of ${money(c.benefit_limit)}.`,
    edgeCase: c.claim_id === EDGE_CASE_ID,
  }));
  const selected = entries.find((e) => e.c.claim_id === selectedId) ?? entries[0];

  const resolve = (item: ApprovalItem) => setQueue((prev: ReviewItem[]) => prev.filter((q) => q.claim_id !== item.id));

  const approve = (item: ApprovalItem) => {
    update(item.id, { claim_status: "In reconsideration" });
    addContact({
      claim_id: item.id,
      at: Date.now(),
      contact_by: "Joaquin Reyes",
      channel: "Fax",
      outcome: "Reconsideration letter sent to the adjuster",
      next_action_at: Date.now() + 7 * 86_400_000,
    });
    resolve(item);
    logAction("Reconsideration approved and sent to the adjuster", "approve-and-send-reconsideration");
  };

  const handToLop = (item: ApprovalItem) => {
    update(item.id, { claim_status: "Handed to LOP" });
    addContact({
      claim_id: item.id,
      at: Date.now(),
      contact_by: "Joaquin Reyes",
      channel: "Handoff",
      outcome: "Balance and full claim history sent to Marcus Odum",
      next_action_at: null,
    });
    resolve(item);
    logAction("Balance handed to the LOP coordinator with claim history", "hand-to-lop");
  };

  return (
    <AppShell {...SHELL} nav={NAV}>
      <h1 className="text-3xl" style={{ fontFamily: "var(--pf-font-heading)" }}>Review</h1>
      <p className="mt-2 max-w-2xl text-[var(--pf-muted)]">
        Nothing reaches a carrier and no balance moves to the LOP coordinator until you approve it here. Read the
        letter, check the benefits used against the limit, then decide.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="text-lg" style={{ fontFamily: "var(--pf-font-heading)" }}>Waiting for your approval</h2>
          <p className="text-sm text-[var(--pf-muted)]">
            {items.length === 0 ? "Nothing is waiting. Move a denial here from Denials." : `${items.length} waiting`}
          </p>
          <div className="mt-3">
            <ApprovalQueue
              items={items}
              dataTour="approval-queue"
              primaryLabel="Approve and send to adjuster"
              secondaryLabel="Hand balance to LOP coordinator"
              primaryActionId="approve-and-send-reconsideration"
              secondaryActionId="hand-to-lop"
              onPrimary={approve}
              onSecondary={handToLop}
            />
          </div>
        </section>

        {selected && (
          <section>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--pf-muted)]">Letter shown</span>
              <select
                value={selected.c.claim_id}
                onChange={(e) => setSelectedId(e.target.value)}
                className="min-h-[44px] rounded-lg border border-[var(--pf-muted)]/30 bg-[var(--pf-surface)] px-3"
              >
                {entries.map(({ q, c }) => (
                  <option key={c.claim_id} value={c.claim_id}>
                    Claim {c.claim_id}, {q.kind === "reconsideration" ? "reconsideration letter" : "LOP handoff"}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-3">
              <DocumentViewer
                title={
                  selected.q.kind === "reconsideration"
                    ? `Drafted reconsideration, claim ${selected.c.claim_id}`
                    : `LOP handoff summary, claim ${selected.c.claim_id}`
                }
                field="billed_amount"
                lines={selected.q.kind === "reconsideration" ? reconsiderationLetter(selected.c) : handoffSummary(selected.c, added)}
              />
            </div>
          </section>
        )}
      </div>

      <section className="mt-10 max-w-3xl">
        <h2 className="text-lg" style={{ fontFamily: "var(--pf-font-heading)" }}>Activity in this demo</h2>
        <div className="mt-3">
          <AuditLog />
        </div>
      </section>
      {isLoggedIn() && <TourRunner steps={tour} storageKey="pf-tour-pip-claim-denial-tracker-v1" />}
    </AppShell>
  );
}
