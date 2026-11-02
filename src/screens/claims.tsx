import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell, ChartBar, DataTable, MetricPanel, StatusPill, TourRunner, formatDate, useActivity, type DataTableColumn } from "@kit";
import { NAV } from "../nav";
import tour from "../tour.json";
import { CARRIERS, EDGE_CASE_LABEL, REASONS, type ClaimStatus } from "../seed";
import { calendarDaysUntil, isLoggedIn, money, SHELL, STATUS_TONE, useClaims, type LiveClaim } from "./claimState";

const OPEN_DENIAL: ClaimStatus[] = ["Denied", "Underpaid", "Records requested"];

// Short bar labels so the chart reads at phone width.
const REASON_SHORT: Record<string, string> = {
  [REASONS.records]: "Records",
  [REASONS.claimNumber]: "Claim no.",
  [REASONS.modifier]: "Modifier",
  [REASONS.underpaid]: "Underpaid",
  [REASONS.exhausted]: "Exhausted",
  [EDGE_CASE_LABEL]: "Exhausted",
};

const columns: DataTableColumn<LiveClaim>[] = [
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
  { key: "date_of_service", header: "Date of service", render: (c) => formatDate(c.date_of_service) },
  { key: "billed_amount", header: "Billed", render: (c) => money(c.billed_amount) },
  { key: "paid_amount", header: "Paid", render: (c) => money(c.paid_amount) },
  {
    key: "benefits_paid_to_date",
    header: "Benefits used",
    render: (c) => `${money(c.benefits_paid_to_date)} of ${money(c.benefit_limit)}`,
  },
  { key: "adjuster_name", header: "Adjuster", render: (c) => c.adjuster_name },
  { key: "claim_status", header: "Status", render: (c) => <StatusPill label={c.claim_status} tone={STATUS_TONE[c.claim_status]} /> },
];

export default function Claims() {
  const navigate = useNavigate();
  const { logAction } = useActivity();
  const { claims } = useClaims();
  const [carrierChoice, setCarrierChoice] = useState<string>(CARRIERS[0].name);
  const [carrierFilter, setCarrierFilter] = useState<string | null>(null);

  const metrics = useMemo(() => {
    const submitted = claims.filter((c) => c.submitted_date !== null);
    const firstPass = submitted.filter((c) => c.accepted_first_pass).length / Math.max(1, submitted.length);
    const dueSoon = claims.filter(
      (c) =>
        OPEN_DENIAL.includes(c.claim_status) &&
        [c.appeal_deadline, c.timely_filing_deadline].some((d) => d && calendarDaysUntil(d) >= 0 && calendarDaysUntil(d) <= 7)
    ).length;
    const arOver90 = claims
      .filter((c) => c.claim_status !== "Paid" && c.claim_status !== "Handed to LOP" && calendarDaysUntil(c.date_of_service) < -90)
      .reduce((sum, c) => sum + (c.billed_amount - c.paid_amount), 0);
    const lop = claims.filter((c) => c.claim_status === "Handed to LOP").length;
    return [
      { label: "First-pass acceptance rate", value: `${Math.round(firstPass * 100)}%`, hint: `${submitted.length} claims submitted` },
      { label: "Deadlines in the next 7 days", value: String(dueSoon), hint: "Open denials and underpayments" },
      { label: "Insurance A/R over 90 days", value: money(arOver90), hint: "Not paid, not handed to LOP" },
      { label: "Balances handed to LOP", value: String(lop), hint: "Benefits used up" },
    ];
  }, [claims]);

  const chart = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of claims) {
      if (!c.denial_reason) continue;
      const label = REASON_SHORT[c.denial_reason] ?? c.denial_reason;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()].map(([reason, claims]) => ({ reason, claims })).sort((a, b) => b.claims - a.claims);
  }, [claims]);

  const rows = carrierFilter ? claims.filter((c) => c.carrier === carrierFilter) : claims;

  return (
    <AppShell {...SHELL} nav={NAV}>
      <h1 className="text-3xl" style={{ fontFamily: "var(--pf-font-heading)" }}>Claims</h1>
      <p className="mt-2 max-w-2xl text-[var(--pf-muted)]">
        Every PIP claim from submission to payment, denial or handoff, newest date of service first.
      </p>

      <div className="mt-6">
        <MetricPanel metrics={metrics} dataTour="claims-metrics" />
      </div>

      <section className="mt-6 rounded-2xl border border-[var(--pf-muted)]/20 p-4">
        <h2 className="text-lg" style={{ fontFamily: "var(--pf-font-heading)" }}>Denials by reason</h2>
        <p className="text-sm text-[var(--pf-muted)]">Every claim a carrier denied, underpaid or asked records for.</p>
        <div className="mt-3">
          <ChartBar data={chart} xKey="reason" yKey="claims" />
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--pf-muted)]">Carrier</span>
            <select
              value={carrierChoice}
              onChange={(e) => setCarrierChoice(e.target.value)}
              className="min-h-[44px] rounded-lg border border-[var(--pf-muted)]/30 bg-[var(--pf-surface)] px-3"
            >
              {CARRIERS.map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            data-action="filter-by-carrier"
            onClick={() => {
              setCarrierFilter(carrierChoice);
              logAction("Filtered claims by carrier", "filter-by-carrier");
            }}
            className="min-h-[44px] rounded-lg bg-[var(--pf-primary)] px-4 text-sm font-medium text-[var(--pf-surface)]"
          >
            Filter by carrier
          </button>
          {carrierFilter && (
            <button
              type="button"
              onClick={() => setCarrierFilter(null)}
              className="min-h-[44px] rounded-lg border border-[var(--pf-muted)]/30 px-4 text-sm"
            >
              Show all carriers
            </button>
          )}
        </div>
        <p className="mt-3 text-sm text-[var(--pf-muted)]">
          {carrierFilter ? `${rows.length} claims from ${carrierFilter}` : `${rows.length} claims from five auto carriers`}
        </p>
        <div className="mt-3">
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
      {isLoggedIn() && <TourRunner steps={tour} storageKey="pf-tour-pip-claim-denial-tracker-v1" />}
    </AppShell>
  );
}
