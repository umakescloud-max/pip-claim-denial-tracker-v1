import { useState, type ReactNode } from "react";
import {
  AppShell,
  DataTable,
  Masked,
  RecordDrawer,
  SampleDocuments,
  ScenarioBanner,
  StatusPill,
  TourRunner,
  formatDate,
  useActivity,
  type DataTableColumn,
} from "@kit";
import { NAV } from "../nav";
import tour from "../tour.json";
import { denials, EDGE_CASE_ID, REASONS, type ClaimStatus } from "../seed";
import { calendarDaysUntil, countdown, isLoggedIn, money, SHELL, STATUS_TONE, useClaims, type LiveClaim } from "./claimState";

const OPEN_DENIAL: ClaimStatus[] = ["Denied", "Underpaid", "Records requested"];

const columns: DataTableColumn<LiveClaim>[] = [
  {
    key: "claim_id",
    header: "Claim",
    render: (c) => (
      <span>
        <span className="font-medium">{c.claim_id}</span>{" "}
        <span className="text-[var(--pf-muted)]">{c.patient_name}</span>
        <span className="mt-0.5 block text-xs font-normal text-[var(--pf-ink)] sm:hidden">{c.denial_reason}</span>
      </span>
    ),
  },
  {
    key: "denial_reason",
    header: "Reason",
    render: (c) =>
      c.claim_id === EDGE_CASE_ID ? (
        <span className="rounded-md bg-[var(--pf-accent)] px-2 py-0.5 font-medium text-[var(--pf-ink)]">{c.denial_reason}</span>
      ) : (
        c.denial_reason
      ),
  },
  { key: "carrier", header: "Carrier", render: (c) => c.carrier },
  {
    key: "benefits_paid_to_date",
    header: "Benefits used",
    render: (c) => `${money(c.benefits_paid_to_date)} of ${money(c.benefit_limit)}`,
  },
  { key: "appeal_deadline", header: "Days left", render: (c) => countdown(OPEN_DENIAL.includes(c.claim_status) ? c.appeal_deadline : null) },
  {
    key: "claim_status",
    header: "Status",
    render: (c) => (
      <span className="inline-flex flex-wrap gap-1">
        <StatusPill label={c.claim_status} tone={STATUS_TONE[c.claim_status]} />
        {c.in_review && <StatusPill label="Waiting for approval" tone="muted" />}
      </span>
    ),
  },
];

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--pf-muted)]/10 py-2 text-sm">
      <dt className="text-[var(--pf-muted)]">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

export default function Denials() {
  const { logAction } = useActivity();
  const { byId, setQueue, update } = useClaims();
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = denials.map((d) => byId.get(d.claim_id)!);
  const edge = byId.get(EDGE_CASE_ID)!;
  const open = openId ? byId.get(openId) ?? null : null;
  const dueSoon = rows
    .filter((c) => OPEN_DENIAL.includes(c.claim_status) && c.appeal_deadline)
    .filter((c) => calendarDaysUntil(c.appeal_deadline!) >= 0 && calendarDaysUntil(c.appeal_deadline!) <= 7)
    .sort((a, b) => a.appeal_deadline!.getTime() - b.appeal_deadline!.getTime());

  const attach = (c: LiveClaim) => {
    update(c.claim_id, { payment_history_attached: true });
    logAction("Carrier payment history attached to claim 5208", "attach-payment-history");
  };

  const moveToReview = (c: LiveClaim) => {
    const kind = c.denial_reason === REASONS.exhausted ? "lop-handoff" : "reconsideration";
    setQueue((prev) => [{ claim_id: c.claim_id, kind }, ...prev.filter((q) => q.claim_id !== c.claim_id)]);
    setOpenId(null);
    logAction("Claim moved to reconsideration review", "move-to-reconsideration");
  };

  return (
    <AppShell {...SHELL} nav={NAV}>
      <h1 className="text-3xl" style={{ fontFamily: "var(--pf-font-heading)" }}>Denials</h1>
      <p className="mt-2 max-w-2xl text-[var(--pf-muted)]">
        Denied, underpaid and records-requested claims, with the benefits used against the limit and the business
        days left to the appeal deadline.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <ScenarioBanner
            dataTour="exhaustion-banner"
            title={`Claim ${edge.claim_id} is flagged: exhausted per carrier, limit not reached`}
            body={`${edge.carrier} denied claim ${edge.claim_id} (${edge.patient_name}, ${edge.visits} physical therapy visits, ${money(edge.billed_amount)}) as benefits exhausted, but its own payments total ${money(edge.benefits_paid_to_date)} of the ${money(edge.benefit_limit)} limit, leaving ${money(edge.benefit_limit - edge.benefits_paid_to_date)}. Nothing is disputed or sent to the LOP side until you act.`}
          />
          <section data-tour="appeal-countdown" className="rounded-2xl border border-[var(--pf-muted)]/20 p-4">
            <h2 className="text-lg" style={{ fontFamily: "var(--pf-font-heading)" }}>Appeal deadlines in the next 7 days</h2>
            {dueSoon.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--pf-muted)]">No open denial has a deadline in the next 7 days.</p>
            ) : (
              <ul className="mt-2 divide-y divide-[var(--pf-muted)]/10">
                {dueSoon.map((c) => (
                  <li key={c.claim_id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm">
                    <span>
                      <span className="font-medium">Claim {c.claim_id}</span>{" "}
                      <span className="text-[var(--pf-muted)]">{c.patient_name}, {c.carrier}</span>
                    </span>
                    <span className="whitespace-nowrap">
                      <span
                        className={`rounded-md px-2 py-0.5 font-medium ${c.claim_id === EDGE_CASE_ID ? "bg-[var(--pf-accent)] text-[var(--pf-ink)]" : ""}`}
                      >
                        {countdown(c.appeal_deadline)}
                      </span>{" "}
                      <span className="text-[var(--pf-muted)]">{formatDate(c.appeal_deadline!)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <SampleDocuments screenId="denials" />
      </div>

      <section className="mt-8">
        <h2 className="text-lg" style={{ fontFamily: "var(--pf-font-heading)" }}>Open denials</h2>
        <p className="text-sm text-[var(--pf-muted)]">Click a claim to work it.</p>
        <div className="mt-3">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(c) => c.claim_id}
            dataTour="denial"
            edgeCaseRow={(r) => r.claim_id === "5208"}
            mobileStatusKey="claim_status"
            mobileUrgencyKey="appeal_deadline"
            onRowClick={(c) => setOpenId(c.claim_id)}
          />
        </div>
      </section>

      <RecordDrawer open={open !== null} title={open ? `Claim ${open.claim_id}` : ""} onClose={() => setOpenId(null)}>
        {open && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <StatusPill label={open.claim_status} tone={STATUS_TONE[open.claim_status]} />
              {open.in_review && <StatusPill label="Waiting for approval" tone="muted" />}
            </div>
            <dl>
              <Row label="Patient">{open.patient_name}</Row>
              <Row label="Carrier">{open.carrier}</Row>
              <Row label="Carrier claim number">{open.claim_number}</Row>
              <Row label="Adjuster"><Masked field="adjuster_name">{open.adjuster_name}</Masked></Row>
              <Row label="Billed"><Masked field="billed_amount">{money(open.billed_amount)}</Masked></Row>
              <Row label="Paid"><Masked field="paid_amount">{money(open.paid_amount)}</Masked></Row>
              <Row label="Reason">{open.denial_reason}</Row>
              <Row label="Appeal deadline">
                {open.appeal_deadline ? `${formatDate(open.appeal_deadline)}, ${countdown(open.appeal_deadline).toLowerCase()}` : "None"}
              </Row>
            </dl>

            {open.claim_id === EDGE_CASE_ID ? (
              <div className="space-y-3 rounded-xl border border-[var(--pf-muted)]/20 p-4">
                <h3 className="text-sm font-medium">Carrier payment history</h3>
                {open.payment_history_attached ? (
                  <dl>
                    <Row label="Paid to date">{money(open.benefits_paid_to_date)}</Row>
                    <Row label="Benefit limit">{money(open.benefit_limit)}</Row>
                    <Row label="Left on limit">
                      <span className="font-medium">{money(open.benefit_limit - open.benefits_paid_to_date)}</span>
                    </Row>
                  </dl>
                ) : (
                  <>
                    <p className="text-sm text-[var(--pf-muted)]">
                      The carrier says the benefits are used up. Attach its payment history to show what it has paid.
                    </p>
                    <button
                      type="button"
                      data-action="attach-payment-history"
                      onClick={() => attach(open)}
                      className="min-h-[44px] w-full rounded-lg border border-[var(--pf-primary)] px-4 text-sm font-medium text-[var(--pf-primary)]"
                    >
                      Attach carrier payment history
                    </button>
                  </>
                )}
              </div>
            ) : (
              <p className="text-sm">
                Benefits used: {money(open.benefits_paid_to_date)} of {money(open.benefit_limit)}
                {open.benefits_paid_to_date >= open.benefit_limit ? ", limit reached." : "."}
              </p>
            )}

            {open.in_review ? (
              <p className="rounded-lg bg-[var(--pf-muted)]/10 p-3 text-sm">This claim is waiting for your approval on Review.</p>
            ) : OPEN_DENIAL.includes(open.claim_status) ? (
              <button
                type="button"
                data-action="move-to-reconsideration"
                onClick={() => moveToReview(open)}
                className="min-h-[44px] w-full rounded-lg bg-[var(--pf-primary)] px-4 text-sm font-medium text-[var(--pf-surface)]"
              >
                Move to reconsideration review
              </button>
            ) : (
              <p className="rounded-lg bg-[var(--pf-muted)]/10 p-3 text-sm">{open.claim_status}: nothing left to do here.</p>
            )}
          </div>
        )}
      </RecordDrawer>
      {isLoggedIn() && <TourRunner steps={tour} storageKey="pf-tour-pip-claim-denial-tracker-v1" />}
    </AppShell>
  );
}
