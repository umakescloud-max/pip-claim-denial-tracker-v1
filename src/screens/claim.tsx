import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppShell, AuditLog, DocumentViewer, Masked, StatusPill, Timeline, formatDateTime, rel, useActivity, useDemoState, type TimelineEntry } from "@kit";
import { NAV } from "../nav";
import { BILLING_LEAD, CLAIMS, CONTACTS, CPT_LABELS, DIAGNOSES, EDGE_CLAIM_ID, EDGE_LABEL, EDGE_PAYMENTS, type Claim, type Contact } from "../seed";
import { SHELL, claimStatusLabel, claimStatusTone, headingStyle, money, shortDate } from "./lib";

export default function ClaimScreen() {
  const [params] = useSearchParams();
  const { logAction } = useActivity();
  const [claims] = useDemoState<Claim[]>("claims", CLAIMS);
  const [contacts, setContacts] = useDemoState<Contact[]>("contacts", CONTACTS);
  const [outcome, setOutcome] = useState("");
  const [channel, setChannel] = useState<Contact["channel"]>("Phone");

  const wanted = params.get("case") ?? EDGE_CLAIM_ID;
  const claim = claims.find((c) => c.claim_id === wanted) ?? claims.find((c) => c.claim_id === EDGE_CLAIM_ID)!;
  const isEdge = claim.claim_id === EDGE_CLAIM_ID;
  const claimContacts = contacts.filter((c) => c.claim_id === claim.claim_id);

  const entries = useMemo<TimelineEntry[]>(() => {
    const list: { at: Date; author: string; text: string; id: string }[] = [];
    if (isEdge) {
      let used = 0;
      for (const [i, p] of EDGE_PAYMENTS.entries()) {
        used += p.amount;
        list.push({
          id: `pay-${i}`,
          at: p.date,
          author: "Harborline Auto Insurance",
          text: `Payment posted on an earlier bill: ${money(p.amount)} for ${p.covers.toLowerCase()}. Benefits used ${money(used)} of ${money(claim.benefit_limit)}.`,
        });
      }
    }
    if (claim.submitted_date)
      list.push({ id: "submitted", at: claim.submitted_date, author: "Office Ally", text: `Claim submitted to ${claim.carrier} for ${money(claim.billed_amount)}.` });
    if (claim.receipt_date)
      list.push({ id: "receipt", at: claim.receipt_date, author: claim.carrier, text: "Carrier confirmed it received the bill." });
    if (claim.payment_date)
      list.push({ id: "eob-paid", at: claim.payment_date, author: claim.carrier, text: `EOB received: paid ${money(claim.paid_amount)}. Payment posted in Practice Mate.` });
    if (claim.denial_date)
      list.push({
        id: "eob-denied",
        at: claim.denial_date,
        author: claim.carrier,
        text:
          claim.claim_status === "underpaid" || claim.denial_reason === "Underpaid against fee schedule"
            ? `EOB dated: paid ${money(claim.paid_amount)} of ${money(claim.billed_amount)}, cut to the fee schedule.`
            : isEdge
              ? "EOB dated: denied as benefits exhausted."
              : `EOB dated: ${claim.denial_reason?.toLowerCase()}.`,
      });
    for (const c of claimContacts)
      list.push({
        id: c.id,
        at: c.contact_date,
        author: c.contact_by,
        text: `${c.channel}: ${c.outcome}. Next action ${shortDate(c.next_action_date)}.`,
      });
    if (claim.review && claim.review_since)
      list.push({
        id: "review",
        at: claim.review_since,
        author: BILLING_LEAD,
        text: claim.review === "reconsideration" ? "Moved to reconsideration review." : "Queued for review before the balance goes to the LOP coordinator.",
      });
    list.sort((a, b) => a.at.getTime() - b.at.getTime());
    const out: TimelineEntry[] = list.map((e) => ({ id: e.id, timestamp: formatDateTime(e.at), author: e.author, text: e.text }));
    if (claim.next_follow_up)
      out.push({ id: "next", timestamp: shortDate(claim.next_follow_up), author: "Tracker", text: "Next follow-up due." });
    return out;
  }, [claim, claimContacts, isEdge]);

  const left = claim.benefit_limit - claim.benefits_paid_to_date;
  const usedPct = Math.min(100, Math.round((claim.benefits_paid_to_date / claim.benefit_limit) * 100));
  const hasEob = !!(claim.payment_date || claim.denial_date);

  const logContact = () => {
    const now = new Date();
    const text = outcome.trim() || `Called the adjuster at ${formatDateTime(now)}, no new outcome`;
    setContacts((prev) => [
      ...prev,
      { id: `new-${now.getTime()}`, claim_id: claim.claim_id, contact_date: now, contact_by: BILLING_LEAD, channel, outcome: text, next_action_date: rel(7) },
    ]);
    setOutcome("");
    logAction("Adjuster contact logged on the claim", "add-follow-up-note");
  };

  return (
    <AppShell {...SHELL} nav={NAV}>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl" style={headingStyle}>Claim {claim.claim_id}</h1>
        <StatusPill label={claimStatusLabel(claim)} tone={claimStatusTone(claim)} />
      </div>
      <p className="mt-2 max-w-2xl text-[var(--pf-muted)]">
        {claim.patient_name}, case {claim.case_id}, referred by {claim.referring_firm}. {claim.carrier}, carrier claim number{" "}
        {claim.claim_number}.
      </p>
      {isEdge && claim.denial_reason === EDGE_LABEL && (
        <p className="mt-3 inline-block rounded-lg bg-[var(--pf-accent)] px-3 py-1.5 text-sm text-[var(--pf-ink)]">{EDGE_LABEL}</p>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="min-w-0">
          <h2 className="text-lg" style={headingStyle}>Claim history</h2>
          <div className="mt-4">
            <Timeline entries={entries} dataTour="claim-timeline" />
          </div>

          <div className="mt-8 rounded-2xl border border-[var(--pf-muted)]/20 p-4">
            <h3 className="font-medium">Log an adjuster contact</h3>
            <p className="mt-1 text-sm text-[var(--pf-muted)]">
              The next action date is set 7 days out, on {shortDate(rel(7))}. Leave the outcome empty to log a call with no news.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--pf-muted)]">How</span>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as Contact["channel"])}
                  className="min-h-[44px] rounded-lg border border-[var(--pf-muted)]/30 bg-[var(--pf-surface)] px-2"
                >
                  <option>Phone</option>
                  <option>Portal message</option>
                  <option>Fax</option>
                </select>
              </label>
              <label className="flex min-w-0 flex-1 basis-56 flex-col gap-1 text-sm">
                <span className="text-[var(--pf-muted)]">Outcome</span>
                <input
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  placeholder="Adjuster confirmed claim in review"
                  className="min-h-[44px] w-full rounded-lg border border-[var(--pf-muted)]/30 bg-[var(--pf-surface)] px-3"
                />
              </label>
              <button
                type="button"
                data-action="add-follow-up-note"
                onClick={logContact}
                className="min-h-[44px] rounded-lg bg-[var(--pf-primary)] px-4 py-2 text-sm font-medium text-[var(--pf-surface)]"
              >
                Log adjuster contact
              </button>
            </div>
          </div>
        </section>

        <aside className="min-w-0 space-y-6">
          <section className="rounded-2xl border border-[var(--pf-muted)]/20 p-4">
            <h2 className="text-lg" style={headingStyle}>Benefits used</h2>
            <p className="mt-2 text-sm">
              {money(claim.benefits_paid_to_date)} of {money(claim.benefit_limit)} paid on this case, {money(left)} left.
            </p>
            <div className="mt-2 h-2 rounded-full bg-[var(--pf-muted)]/15" aria-hidden="true">
              <div className="h-2 rounded-full bg-[var(--pf-primary)]" style={{ width: `${usedPct}%` }} />
            </div>
            <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
              <dt className="text-[var(--pf-muted)]">Date of service</dt>
              <dd>{shortDate(claim.date_of_service)}, {claim.visits} {claim.visits === 1 ? "visit" : "visits"}</dd>
              <dt className="text-[var(--pf-muted)]">Billed</dt>
              <dd><Masked field="billed_amount">{money(claim.billed_amount)}</Masked></dd>
              <dt className="text-[var(--pf-muted)]">Paid</dt>
              <dd><Masked field="paid_amount">{money(claim.paid_amount)}</Masked></dd>
              <dt className="text-[var(--pf-muted)]">Adjuster</dt>
              <dd><Masked field="adjuster_name">{claim.adjuster_name}</Masked></dd>
              <dt className="text-[var(--pf-muted)]">CPT codes</dt>
              <dd>
                <Masked field="cpt_codes">{claim.cpt_codes.map((c) => `${c} ${CPT_LABELS[c] ?? ""}`.trim()).join("; ")}</Masked>
              </dd>
              <dt className="text-[var(--pf-muted)]">Diagnosis</dt>
              <dd>
                <Masked field="diagnosis_codes">{claim.diagnosis_codes.map((d) => `${d} ${DIAGNOSES[d] ?? ""}`.trim()).join("; ")}</Masked>
              </dd>
              <dt className="text-[var(--pf-muted)]">Date of loss</dt>
              <dd>{shortDate(claim.date_of_loss)}</dd>
            </dl>
          </section>

          <DocumentViewer
            title={`Latest EOB from ${claim.carrier}`}
            field="paid_amount"
            missing={!hasEob}
            lines={[
              `Carrier claim number ${claim.claim_number}`,
              `Billed ${money(claim.billed_amount)}, paid ${money(claim.paid_amount)}`,
              claim.denial_reason
                ? `Carrier reason: ${isEdge ? "benefits exhausted" : claim.denial_reason.toLowerCase()}`
                : "Outcome: paid",
              ...(isEdge ? [`Tracker check: limit not reached, ${money(left)} left of ${money(claim.benefit_limit)}`] : []),
              ...(claim.appeal_deadline && claim.denial_reason ? [`Appeal deadline ${shortDate(claim.appeal_deadline)}`] : []),
            ]}
          />

          <section>
            <h2 className="text-lg" style={headingStyle}>Activity in this demo</h2>
            <div className="mt-3">
              <AuditLog />
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
