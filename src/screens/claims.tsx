import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell, ChartBar, DataTable, MetricPanel, StatusPill, useActivity, useDemoState, type DataTableColumn } from "@kit";
import { NAV } from "../nav";
import { CARRIERS, CLAIMS, DENIAL_REASONS, EDGE_LABEL, type Claim } from "../seed";
import { OPEN_DENIAL, SHELL, claimStatusLabel, claimStatusTone, daysFromToday, headingStyle, money, shortDate } from "./lib";

const SHORT_REASON: Record<string, string> = {
  "Records requested": "Records",
  "Carrier claim number missing": "Claim no.",
  "Modifier missing": "Modifier",
  "Underpaid against fee schedule": "Fee schedule",
  "Benefits exhausted per carrier": "Exhausted",
  [EDGE_LABEL]: "Limit left",
};

export default function Claims() {
  const navigate = useNavigate();
  const { logAction } = useActivity();
  const [claims] = useDemoState<Claim[]>("claims", CLAIMS);
  const [carrierChoice, setCarrierChoice] = useState<string>(CARRIERS[0].name);
  const [carrierFilter, setCarrierFilter] = useState<string | null>(null);

  const metrics = useMemo(() => {
    const submitted = claims.filter((c) => c.submitted_date);
    const firstPass = submitted.filter((c) => c.accepted_first_pass).length;
    const soon = claims.filter(
      (c) =>
        OPEN_DENIAL.includes(c.claim_status) &&
        [c.appeal_deadline, c.timely_filing_deadline].some((d) => d && daysFromToday(d) >= 0 && daysFromToday(d) <= 7)
    ).length;
    const old = claims.filter(
      (c) => c.claim_status !== "paid" && c.claim_status !== "handed to LOP" && daysFromToday(c.date_of_service) < -90
    );
    const arOver90 = old.reduce((s, c) => s + (c.billed_amount - c.paid_amount), 0);
    const lop = claims.filter((c) => c.claim_status === "handed to LOP").length;
    return [
      {
        label: "First-pass acceptance rate",
        value: submitted.length ? `${Math.round((firstPass / submitted.length) * 100)}%` : "0%",
        hint: `${firstPass} of ${submitted.length} submitted claims accepted on first pass`,
      },
      { label: "Deadlines in the next 7 days", value: String(soon), hint: "Open denials with an appeal or filing deadline within 7 days" },
      { label: "Insurance A/R over 90 days", value: money(arOver90), hint: `Billed minus paid on ${old.length} unpaid claims with service over 90 days ago` },
      { label: "Balances handed to LOP", value: String(lop), hint: "Claims whose balance went to the LOP coordinator" },
    ];
  }, [claims]);

  const byReason = useMemo(
    () =>
      DENIAL_REASONS.map((reason) => ({
        reason: SHORT_REASON[reason],
        full: reason,
        claims: claims.filter((c) => c.denial_reason === reason).length,
      })),
    [claims]
  );

  const rows = useMemo(
    () =>
      claims
        .filter((c) => !carrierFilter || c.carrier === carrierFilter)
        .slice()
        .sort((a, b) => b.date_of_service.getTime() - a.date_of_service.getTime()),
    [claims, carrierFilter]
  );

  const columns: DataTableColumn<Claim>[] = [
    {
      key: "claim_id",
      header: "Claim",
      render: (c) => (
        <span>
          <span className="font-medium">{c.claim_id}</span>{" "}
          <span className="text-[var(--pf-muted)]">{c.patient_name}</span>
        </span>
      ),
    },
    { key: "carrier", header: "Carrier", render: (c) => c.carrier },
    { key: "date_of_service", header: "Date of service", render: (c) => shortDate(c.date_of_service) },
    { key: "billed_amount", header: "Billed", render: (c) => money(c.billed_amount) },
    { key: "paid_amount", header: "Paid", render: (c) => money(c.paid_amount) },
    {
      key: "benefits_paid_to_date",
      header: "Benefits used",
      render: (c) => `${money(c.benefits_paid_to_date)} of ${money(c.benefit_limit)}`,
    },
    { key: "claim_status", header: "Status", render: (c) => <StatusPill label={claimStatusLabel(c)} tone={claimStatusTone(c)} /> },
  ];

  return (
    <AppShell {...SHELL} nav={NAV}>
      <h1 className="text-2xl" style={headingStyle}>Claims</h1>
      <p className="mt-2 max-w-2xl text-[var(--pf-muted)]">
        Every PIP claim from submission to payment, denial or handoff, newest date of service first. Click a claim to
        open its history.
      </p>

      <div className="mt-6">
        <MetricPanel metrics={metrics} dataTour="claims-metrics" />
      </div>

      <section className="mt-8 rounded-2xl border border-[var(--pf-muted)]/20 p-4">
        <h2 className="text-lg" style={headingStyle}>Denials by reason</h2>
        <p className="mt-1 text-sm text-[var(--pf-muted)]">Count of claims carrying each denial reason, from the claims below.</p>
        <div className="mt-3">
          <ChartBar data={byReason.map(({ reason, claims: n }) => ({ reason, claims: n }))} xKey="reason" yKey="claims" />
        </div>
        <ul className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {byReason.map((r) => (
            <li key={r.full} className="flex justify-between gap-3">
              <span>
                {r.full} <span className="text-[var(--pf-muted)]">({r.reason})</span>
              </span>
              <span className="font-medium">{r.claims}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="text-[var(--pf-muted)]">Carrier</span>
            <select
              value={carrierChoice}
              onChange={(e) => setCarrierChoice(e.target.value)}
              className="min-h-[44px] max-w-full rounded-lg border border-[var(--pf-muted)]/30 bg-[var(--pf-surface)] px-2"
            >
              <option value="">All carriers</option>
              {CARRIERS.map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            data-action="filter-by-carrier"
            onClick={() => {
              setCarrierFilter(carrierChoice || null);
              logAction("Filtered claims by carrier", "filter-by-carrier");
            }}
            className="min-h-[44px] rounded-lg bg-[var(--pf-primary)] px-4 py-2 text-sm font-medium text-[var(--pf-surface)]"
          >
            Filter by carrier
          </button>
          <p className="text-sm text-[var(--pf-muted)]">
            Showing {rows.length} of {claims.length} claims{carrierFilter ? ` from ${carrierFilter}` : ""}.
          </p>
        </div>
        <div className="mt-4">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(c) => c.claim_id}
            dataTour="tracker-table"
            rowActionId="open-claim"
            mobileStatusKey="claim_status"
            mobileUrgencyKey="carrier"
            onRowClick={(c) => {
              logAction("Opened claim", "open-claim");
              navigate(`/claim?case=${c.claim_id}`);
            }}
          />
        </div>
      </section>
    </AppShell>
  );
}
