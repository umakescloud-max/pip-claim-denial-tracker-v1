import { useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AppShell,
  AuditLog,
  DocumentViewer,
  Masked,
  StatusPill,
  Timeline,
  TourRunner,
  addBusinessDays,
  formatDate,
  formatDateTime,
  useActivity,
  type TimelineEntry,
} from "@kit";
import { NAV } from "../nav";
import tour from "../tour.json";
import { CPT_LABELS, DIAGNOSIS_LABELS, EDGE_CASE_ID } from "../seed";
import { contactsFor, countdown, isLoggedIn, money, SHELL, STATUS_TONE, useClaims, type LiveClaim } from "./claimState";

const CHANNELS = ["Phone", "Portal message", "Fax"];
const DAY = 86_400_000;

function eobText(c: LiveClaim): string | null {
  switch (c.claim_status) {
    case "Paid":
      return `EOB received: paid ${money(c.paid_amount)} of ${money(c.billed_amount)} billed.`;
    case "Underpaid":
      return `EOB received: paid ${money(c.paid_amount)} of ${money(c.billed_amount)} billed, under the fee schedule.`;
    case "Records requested":
      return "Carrier asked for the treating records before it will pay.";
    case "Pending":
      return null;
    default:
      return c.claim_id === EDGE_CASE_ID
        ? `Carrier notice: denied as benefits exhausted. The carrier's own payments total ${money(c.benefits_paid_to_date)} of the ${money(c.benefit_limit)} limit.`
        : `EOB received: denied, ${c.denial_reason?.toLowerCase()}.`;
  }
}

function buildTimeline(c: LiveClaim, contacts: ReturnType<typeof contactsFor>): TimelineEntry[] {
  const events: { at: Date; entry: Omit<TimelineEntry, "timestamp"> }[] = [];
  if (c.submitted_date) {
    events.push({
      at: c.submitted_date,
      entry: { id: "submitted", author: "Billing system", text: `Claim submitted to ${c.carrier}, ${money(c.billed_amount)} billed.` },
    });
  }
  const eob = eobText(c);
  if (c.eob_date && eob) {
    events.push({ at: c.eob_date, entry: { id: "eob", author: c.carrier, text: eob } });
    if (c.paid_amount > 0) {
      events.push({
        at: new Date(c.eob_date.getTime() + 2 * DAY),
        entry: { id: "payment", author: "Billing system", text: `Payment posted: ${money(c.paid_amount)}.` },
      });
    }
  }
  for (const ct of contacts) {
    const next = ct.next_action_date ? ` Next action ${formatDate(ct.next_action_date)}.` : "";
    events.push({
      at: ct.contact_date,
      entry: { id: ct.id, author: ct.contact_by, text: `${ct.channel}: ${ct.outcome}.${next}` },
    });
  }
  return events
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map(({ at, entry }) => ({ ...entry, timestamp: formatDateTime(at) }));
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-[var(--pf-muted)]">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

export default function ClaimScreen() {
  const [params] = useSearchParams();
  const { logAction } = useActivity();
  const { byId, added, addContact } = useClaims();
  const claim = byId.get(params.get("case") ?? EDGE_CASE_ID) ?? byId.get(EDGE_CASE_ID)!;
  const [channel, setChannel] = useState(CHANNELS[0]);
  const [note, setNote] = useState("");

  const timeline = useMemo(() => buildTimeline(claim, contactsFor(claim.claim_id, added)), [claim, added]);
  const usedPct = Math.min(100, Math.round((claim.benefits_paid_to_date / claim.benefit_limit) * 100));

  const logContact = () => {
    const now = Date.now();
    addContact({
      claim_id: claim.claim_id,
      at: now,
      contact_by: "Joaquin Reyes",
      channel,
      outcome: note.trim() || "Called the adjuster, claim confirmed in review",
      next_action_at: addBusinessDays(new Date(now), 5).getTime(),
    });
    setNote("");
    logAction("Adjuster contact logged on the claim", "add-follow-up-note");
  };

  return (
    <AppShell {...SHELL} nav={NAV}>
      <Link to="/claims" className="inline-flex min-h-[44px] items-center text-sm text-[var(--pf-muted)] underline">
        Back to claims
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl" style={{ fontFamily: "var(--pf-font-heading)" }}>
          Claim {claim.claim_id}
        </h1>
        <StatusPill label={claim.claim_status} tone={STATUS_TONE[claim.claim_status]} />
        {claim.in_review && <StatusPill label="Waiting for approval" tone="muted" />}
      </div>
      <p className="mt-1 text-[var(--pf-muted)]">
        {claim.patient_name}, {claim.carrier}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <section className="rounded-2xl border border-[var(--pf-muted)]/20 p-4">
            <h2 className="text-lg" style={{ fontFamily: "var(--pf-font-heading)" }}>Claim history</h2>
            <div className="mt-4">
              <Timeline entries={timeline} dataTour="claim-timeline" />
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--pf-muted)]/20 p-4">
            <h2 className="text-lg" style={{ fontFamily: "var(--pf-font-heading)" }}>Log an adjuster contact</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--pf-muted)]">How</span>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="min-h-[44px] rounded-lg border border-[var(--pf-muted)]/30 bg-[var(--pf-surface)] px-3"
                >
                  {CHANNELS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="text-[var(--pf-muted)]">Outcome</span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="For example: adjuster confirmed the claim is in review"
                  className="min-h-[44px] rounded-lg border border-[var(--pf-muted)]/30 bg-[var(--pf-surface)] px-3"
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-[var(--pf-muted)]">The next follow-up is set 5 business days out.</p>
            <button
              type="button"
              data-action="add-follow-up-note"
              onClick={logContact}
              className="mt-3 min-h-[44px] rounded-lg bg-[var(--pf-primary)] px-4 text-sm font-medium text-[var(--pf-surface)]"
            >
              Log adjuster contact
            </button>
          </section>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-2xl border border-[var(--pf-muted)]/20 p-4">
            <h2 className="text-lg" style={{ fontFamily: "var(--pf-font-heading)" }}>Benefits used</h2>
            <p className="mt-2 text-sm">
              {money(claim.benefits_paid_to_date)} paid of a {money(claim.benefit_limit)} limit,{" "}
              {money(claim.benefit_limit - claim.benefits_paid_to_date)} left
            </p>
            <div className="mt-2 h-2 rounded-full bg-[var(--pf-muted)]/15" aria-hidden="true">
              <div className="h-2 rounded-full bg-[var(--pf-primary)]" style={{ width: `${usedPct}%` }} />
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--pf-muted)]/20 p-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label="Case">{claim.case_id}</Field>
              <Field label="Date of loss">{formatDate(claim.date_of_loss)}</Field>
              <Field label="Carrier claim number">{claim.claim_number}</Field>
              <Field label="Adjuster"><Masked field="adjuster_name">{claim.adjuster_name}</Masked></Field>
              <Field label="Referring firm">{claim.referring_firm}</Field>
              <Field label="Date of service">
                {formatDate(claim.date_of_service)}
                {claim.visits > 1 ? `, ${claim.visits} visits` : ""}
              </Field>
              <Field label="Billed"><Masked field="billed_amount">{money(claim.billed_amount)}</Masked></Field>
              <Field label="Paid"><Masked field="paid_amount">{money(claim.paid_amount)}</Masked></Field>
              <Field label="Next follow-up">{claim.next_follow_up ? formatDate(claim.next_follow_up) : "None"}</Field>
              <Field label="Appeal deadline">
                {claim.appeal_deadline && claim.claim_status !== "Paid" ? `${formatDate(claim.appeal_deadline)}, ${countdown(claim.appeal_deadline).toLowerCase()}` : "None"}
              </Field>
            </dl>
            <dl className="mt-4 space-y-3 border-t border-[var(--pf-muted)]/15 pt-4">
              <Field label="Procedures">
                <Masked field="cpt_codes">
                  {claim.cpt_codes.map((code) => `${code} ${CPT_LABELS[code]}`).join(", ")}
                </Masked>
              </Field>
              <Field label="Diagnoses">
                <Masked field="diagnosis_codes">
                  {claim.diagnosis_codes.map((code) => `${code} ${DIAGNOSIS_LABELS[code]}`).join(", ")}
                </Masked>
              </Field>
            </dl>
          </section>

          <DocumentViewer
            title="Latest carrier EOB"
            field="paid_amount"
            missing={!claim.eob_date || claim.claim_status === "Pending"}
            lines={[
              `${claim.carrier}, claim ${claim.claim_number}`,
              `Notice dated ${claim.eob_date ? formatDate(claim.eob_date) : "not yet"}`,
              `Billed ${money(claim.billed_amount)}, paid ${money(claim.paid_amount)}`,
              claim.denial_reason ? `Reason given: ${claim.claim_id === EDGE_CASE_ID ? "benefits exhausted" : claim.denial_reason.toLowerCase()}` : "No denial reason",
              `Benefits paid to date ${money(claim.benefits_paid_to_date)} of ${money(claim.benefit_limit)}`,
            ]}
          />

          <section className="rounded-2xl border border-[var(--pf-muted)]/20 p-4">
            <h2 className="text-lg" style={{ fontFamily: "var(--pf-font-heading)" }}>Activity in this demo</h2>
            <div className="mt-3">
              <AuditLog />
            </div>
          </section>
        </div>
      </div>
      {isLoggedIn() && <TourRunner steps={tour} storageKey="pf-tour-pip-claim-denial-tracker-v1" />}
    </AppShell>
  );
}
