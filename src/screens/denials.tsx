import { useMemo, useState } from "react";
import { AppShell, DataTable, Masked, RecordDrawer, SampleDocuments, ScenarioBanner, StatusPill, useActivity, useDemo, useDemoState, type DataTableColumn } from "@kit";
import { NAV } from "../nav";
import { CLAIMS, EDGE_CLAIM_ID, EDGE_LABEL, EDGE_PAYMENTS, type Claim } from "../seed";
import { OPEN_DENIAL, SHELL, claimStatusLabel, claimStatusTone, daysFromToday, daysLeftText, headingStyle, money, nextDeadline, shortDate } from "./lib";

const ON_DENIALS: Claim["claim_status"][] = [...OPEN_DENIAL, "in reconsideration"];

export default function Denials() {
  const { logAction, auditLog } = useActivity();
  const { config } = useDemo();
  const [claims, setClaims] = useDemoState<Claim[]>("claims", CLAIMS);
  const [openId, setOpenId] = useState<string | null>(null);

  // Rows keep the order src/seed.ts gives them: claim 5208 first, then the other open denials by deadline.
  const rows = useMemo(() => claims.filter((c) => ON_DENIALS.includes(c.claim_status)), [claims]);
  const edge = claims.find((c) => c.claim_id === EDGE_CLAIM_ID)!;
  const sampleTitle = config.samples.find((s) => s.record_id === EDGE_CLAIM_ID)?.title;
  const sampleRead = !!sampleTitle && auditLog.some((e) => e.text === `Read sample: ${sampleTitle}`);
  const historyAttached = edge.payment_history_attached || sampleRead;
  const left = edge.benefit_limit - edge.benefits_paid_to_date;
  const edgeDays = edge.appeal_deadline ? daysFromToday(edge.appeal_deadline) : null;
  const soon = rows
    .filter((c) => c.claim_id !== EDGE_CLAIM_ID && OPEN_DENIAL.includes(c.claim_status) && !c.review)
    .map((c) => ({ c, d: nextDeadline(c) }))
    .filter((x): x is { c: Claim; d: Date } => !!x.d && daysFromToday(x.d) <= 7);
  const open = rows.find((c) => c.claim_id === openId) ?? null;

  const update = (id: string, patch: Partial<Claim>) =>
    setClaims((prev) => prev.map((c) => (c.claim_id === id ? { ...c, ...patch } : c)));

  const deadlineCell = (c: Claim) => {
    if (c.claim_status === "in reconsideration") return "Reconsideration sent";
    const d = nextDeadline(c);
    return d ? `${daysLeftText(d)}, ${shortDate(d)}` : "No open deadline";
  };

  const columns: DataTableColumn<Claim>[] = [
    {
      key: "claim_id",
      header: "Claim",
      render: (c) => (
        <span>
          <span className="font-medium">{c.claim_id}</span> <span className="text-[var(--pf-muted)]">{c.patient_name}</span>
          <span className="block text-xs text-[var(--pf-muted)] sm:hidden">{deadlineCell(c)}</span>
        </span>
      ),
    },
    {
      key: "denial_reason",
      header: "Reason",
      render: (c) =>
        c.denial_reason === EDGE_LABEL ? (
          <span className="rounded bg-[var(--pf-accent)] px-1.5 py-0.5 font-medium text-[var(--pf-ink)]">{c.denial_reason}</span>
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
    { key: "billed_amount", header: "Billed", render: (c) => money(c.billed_amount) },
    { key: "appeal_deadline", header: "Deadline", render: deadlineCell },
    { key: "claim_status", header: "Status", render: (c) => <StatusPill label={claimStatusLabel(c)} tone={claimStatusTone(c)} /> },
  ];

  return (
    <AppShell {...SHELL} nav={NAV}>
      <h1 className="text-2xl" style={headingStyle}>Denials</h1>
      <p className="mt-2 max-w-2xl text-[var(--pf-muted)]">
        Denied, underpaid and records-requested claims with the reason, the carrier, benefits used against the limit and the
        days left to dispute. Click a claim to work it.
      </p>

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <ScenarioBanner
          title={EDGE_LABEL}
          body={`${edge.carrier} denied claim ${edge.claim_id} (${edge.patient_name}, ${edge.visits} physical therapy visits, ${money(edge.billed_amount)}) as benefits exhausted, but its own payments total ${money(edge.benefits_paid_to_date)} of the ${money(edge.benefit_limit)} limit, leaving ${money(left)}. Nothing is disputed or sent to the LOP side until you act.`}
        />
        <div data-tour="appeal-countdown" className="rounded-2xl border border-[var(--pf-primary)]/30 p-4">
          <p className="text-sm text-[var(--pf-muted)]">Days left to dispute claim {edge.claim_id}</p>
          <p className="mt-1 text-3xl" style={headingStyle}>
            {edge.claim_status === "in reconsideration"
              ? "Sent"
              : edgeDays === null
                ? "None"
                : edgeDays === 1
                  ? "1 day"
                  : `${edgeDays} days`}
          </p>
          <p className="mt-1 text-sm">
            {edge.claim_status === "in reconsideration"
              ? "The reconsideration is with the adjuster."
              : edge.appeal_deadline
                ? `Appeal deadline ${edge.appeal_deadline.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}.`
                : ""}
          </p>
          <p className="mt-3 text-xs text-[var(--pf-muted)]">
            {soon.length} other open {soon.length === 1 ? "denial has" : "denials have"} a deadline in the next 7 days
            {soon.length > 0 ? `: ${soon.map((x) => `${x.c.claim_id} (${daysLeftText(x.d).toLowerCase()})`).join(", ")}.` : "."}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <SampleDocuments screenId="denials" />
      </div>

      <div className="mt-6">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(c) => c.claim_id}
          dataTour="denial"
          edgeCaseRow={(c) => c.claim_id === EDGE_CLAIM_ID}
          mobileStatusKey="claim_status"
          mobileUrgencyKey="denial_reason"
          onRowClick={(c) => setOpenId(c.claim_id)}
        />
      </div>

      <RecordDrawer open={!!open} title={open ? `Claim ${open.claim_id}, ${open.patient_name}` : ""} onClose={() => setOpenId(null)}>
        {open && (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill label={claimStatusLabel(open)} tone={claimStatusTone(open)} />
              <span>{open.denial_reason}</span>
            </div>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
              <dt className="text-[var(--pf-muted)]">Carrier</dt>
              <dd>{open.carrier}, {open.claim_number}</dd>
              <dt className="text-[var(--pf-muted)]">Adjuster</dt>
              <dd><Masked field="adjuster_name">{open.adjuster_name}</Masked></dd>
              <dt className="text-[var(--pf-muted)]">Billed</dt>
              <dd><Masked field="billed_amount">{money(open.billed_amount)}</Masked></dd>
              <dt className="text-[var(--pf-muted)]">Paid</dt>
              <dd><Masked field="paid_amount">{money(open.paid_amount)}</Masked></dd>
              <dt className="text-[var(--pf-muted)]">Benefit limit</dt>
              <dd>{money(open.benefit_limit)}</dd>
              <dt className="text-[var(--pf-muted)]">Paid to date</dt>
              <dd>{money(open.benefits_paid_to_date)}</dd>
              <dt className="text-[var(--pf-muted)]">Left on limit</dt>
              <dd className="font-medium">{money(open.benefit_limit - open.benefits_paid_to_date)}</dd>
              <dt className="text-[var(--pf-muted)]">Deadline</dt>
              <dd>{deadlineCell(open)}</dd>
            </dl>

            {open.denial_reason === EDGE_LABEL && (
              <div className="rounded-xl border border-[var(--pf-muted)]/20 p-3">
                <h3 className="font-medium">Carrier payment history</h3>
                {historyAttached ? (
                  <>
                    <ul className="mt-2 space-y-1">
                      {EDGE_PAYMENTS.map((p) => (
                        <li key={p.date.getTime()} className="flex justify-between gap-3">
                          <span>{shortDate(p.date)}, {p.covers.toLowerCase()}</span>
                          <span>{money(p.amount)}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 rounded-lg bg-[var(--pf-accent)]/40 p-2">
                      Paid to date {money(open.benefits_paid_to_date)} of a {money(open.benefit_limit)} limit, {money(open.benefit_limit - open.benefits_paid_to_date)} left. The exhaustion denial can be disputed.
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-[var(--pf-muted)]">Not attached yet. Attach it so the reconsideration shows what the carrier itself paid.</p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {open.denial_reason === EDGE_LABEL && (
                <button
                  type="button"
                  data-action="attach-payment-history"
                  disabled={historyAttached}
                  onClick={() => {
                    update(open.claim_id, { payment_history_attached: true });
                    logAction("Carrier payment history attached to claim 5208", "attach-payment-history");
                  }}
                  className="min-h-[44px] rounded-lg border border-[var(--pf-primary)] px-4 py-2 font-medium text-[var(--pf-primary)] disabled:opacity-50"
                >
                  Attach carrier payment history
                </button>
              )}
              {OPEN_DENIAL.includes(open.claim_status) && !open.review ? (
                <button
                  type="button"
                  data-action="move-to-reconsideration"
                  onClick={() => {
                    update(open.claim_id, {
                      review: "reconsideration",
                      review_since: new Date(),
                      payment_history_attached: open.payment_history_attached || (open.claim_id === EDGE_CLAIM_ID && historyAttached),
                    });
                    setOpenId(null);
                    logAction("Claim moved to reconsideration review", "move-to-reconsideration");
                  }}
                  className="min-h-[44px] rounded-lg bg-[var(--pf-primary)] px-4 py-2 font-medium text-[var(--pf-surface)]"
                >
                  Move to reconsideration review
                </button>
              ) : (
                <p className="text-[var(--pf-muted)]">
                  {open.review ? "Waiting on Review for Joaquin's approval." : "The reconsideration is already with the adjuster."}
                </p>
              )}
            </div>
          </div>
        )}
      </RecordDrawer>
    </AppShell>
  );
}
