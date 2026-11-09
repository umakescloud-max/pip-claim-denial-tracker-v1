import { useMemo, useState } from "react";
import {
  ApprovalQueue,
  AppShell,
  DataTable,
  DocumentViewer,
  Masked,
  RecordDrawer,
  SampleDocuments,
  StatusPill,
  useActivity,
  useDemo,
  useDemoState,
  type ApprovalItem,
  type DataTableColumn,
  type StatusTone,
} from "@kit";
import { NAV } from "../nav";
import { CPT_LABELS, LEDGERS, PHYSICIAN, REDUCTION_CASE_ID, ledgerLines, ledgerPayments, type Ledger, type LedgerStatus, type ReductionStatus } from "../seed";
import { SHELL, headingStyle, money, shortDate } from "./lib";

const LEDGER_TONE: Record<LedgerStatus, StatusTone> = {
  "needs final ledger": "accent",
  "final ledger prepared": "primary",
  "sent to attorney": "muted",
};
const LEDGER_LABEL: Record<LedgerStatus, string> = {
  "needs final ledger": "Needs final ledger",
  "final ledger prepared": "Final ledger prepared",
  "sent to attorney": "Sent to attorney",
};
const REDUCTION_LABEL: Record<ReductionStatus, string> = {
  none: "No reduction asked",
  received: "Reduction asked, not yet sent",
  "awaiting physician": `With ${PHYSICIAN}`,
  approved: "Reduction approved",
  declined: "Reduction declined",
};

const visitsText = (l: Ledger) =>
  l.visits_billed === l.visits_completed
    ? `${l.visits_billed} of ${l.visits_completed}`
    : `${l.visits_billed} of ${l.visits_completed}, ${l.visits_completed - l.visits_billed} visit not billed`;
const balanceText = (l: Ledger) =>
  l.reduction_status === "approved" && l.reduction_requested_to !== null
    ? `${money(l.reduction_requested_to)}, reduced from ${money(l.balance_due)}`
    : money(l.balance_due);

export default function Ledgers() {
  const { logAction, auditLog } = useActivity();
  const { config } = useDemo();
  const [stored, setLedgers] = useDemoState<Ledger[]>("ledgers", LEDGERS);
  const [selectedId, setSelectedId] = useState(REDUCTION_CASE_ID);
  const [drawerId, setDrawerId] = useState<string | null>(null);

  // Reading the sample reduction letter sends case 3312's request to the physician, as the sample result says.
  const sampleTitle = config.samples.find((s) => s.record_id === REDUCTION_CASE_ID)?.title;
  const sampleRead = !!sampleTitle && auditLog.some((e) => e.text === `Read sample: ${sampleTitle}`);
  const ledgers = useMemo(
    () =>
      stored.map((l) =>
        sampleRead && l.case_id === REDUCTION_CASE_ID && l.reduction_status === "received"
          ? { ...l, reduction_status: "awaiting physician" as const }
          : l
      ),
    [stored, sampleRead]
  );
  const selected = ledgers.find((l) => l.case_id === selectedId) ?? ledgers[0];
  const drawer = ledgers.find((l) => l.case_id === drawerId) ?? null;
  const waiting = ledgers.filter((l) => l.reduction_status === "awaiting physician");

  const update = (id: string, patch: Partial<Ledger>) =>
    setLedgers((prev) => prev.map((l) => (l.case_id === id ? { ...l, ...patch } : l)));

  const items: ApprovalItem[] = waiting.map((l) => ({
    id: l.case_id,
    title: `Case ${l.case_id}, ${l.patient_name}: reduce ${money(l.balance_due)} to ${money(l.reduction_requested_to ?? l.balance_due)}`,
    subtitle: `${l.referring_firm} asks, reason: ${(l.reduction_reason ?? "").toLowerCase()}. Verified balance and final ledger attached.`,
  }));

  const columns: DataTableColumn<Ledger>[] = [
    {
      key: "case_id",
      header: "Case",
      render: (l) => (
        <span>
          <span className="font-medium">{l.case_id}</span> <span className="text-[var(--pf-muted)]">{l.patient_name}</span>
        </span>
      ),
    },
    { key: "referring_firm", header: "Law firm", render: (l) => l.referring_firm },
    { key: "mmi_date", header: "MMI", render: (l) => shortDate(l.mmi_date) },
    { key: "visits_billed", header: "Visits billed", render: visitsText },
    { key: "total_charges", header: "Charges", render: (l) => money(l.total_charges) },
    { key: "pip_paid", header: "PIP paid", render: (l) => money(l.pip_paid) },
    { key: "adjustments", header: "Adjustments", render: (l) => money(l.adjustments) },
    { key: "balance_due", header: "Balance due", render: balanceText },
    { key: "ledger_status", header: "Ledger", render: (l) => <StatusPill label={LEDGER_LABEL[l.ledger_status]} tone={LEDGER_TONE[l.ledger_status]} /> },
    {
      key: "reduction_status",
      header: "Reduction",
      render: (l) =>
        l.reduction_status === "received" && l.reduction_requested_to !== null
          ? `Asks ${money(l.reduction_requested_to)}, not yet sent`
          : REDUCTION_LABEL[l.reduction_status],
    },
  ];

  const prepare = () => {
    update(selected.case_id, {
      ledger_status: selected.ledger_status === "sent to attorney" ? "sent to attorney" : "final ledger prepared",
      ledger_prepared_on: new Date(),
    });
    logAction("Final itemized bill and ledger prepared", "prepare-final-ledger");
  };
  const sendReduction = () => {
    update(selected.case_id, {
      reduction_status: "awaiting physician",
      ledger_status: selected.ledger_status === "needs final ledger" ? "final ledger prepared" : selected.ledger_status,
      ledger_prepared_on: selected.ledger_prepared_on ?? new Date(),
    });
    logAction("Reduction request sent to Dr. Castell with verified balance", "send-reduction-to-physician");
  };
  const canSend = selected.reduction_status === "received";
  const sendHint: Record<ReductionStatus, string> = {
    none: "No attorney has asked for a reduction on this case.",
    received: `Sends the verified balance and final ledger to ${PHYSICIAN} with the attorney's request.`,
    "awaiting physician": `Already waiting for ${PHYSICIAN}.`,
    approved: `${PHYSICIAN} approved this reduction.`,
    declined: `${PHYSICIAN} declined this reduction.`,
  };

  return (
    <AppShell {...SHELL} nav={NAV}>
      <h1 className="text-2xl" style={headingStyle}>Ledgers at MMI</h1>
      <p className="mt-2 max-w-2xl text-[var(--pf-muted)]">
        Patients who reached maximum medical improvement, with visits, charges, PIP paid, adjustments and the balance due.
        Attorney reduction requests wait for {PHYSICIAN}; nothing is agreed with an attorney until the physician approves.
      </p>

      <section className="mt-6 rounded-2xl border border-[var(--pf-muted)]/20 p-4">
        <h2 className="text-lg" style={headingStyle}>Waiting for {PHYSICIAN} ({waiting.length})</h2>
        <div className="mt-3">
          {items.length > 0 ? (
            <ApprovalQueue
              items={items}
              primaryLabel="Approve reduction"
              secondaryLabel="Decline reduction"
              primaryActionId="approve-reduction"
              secondaryActionId="decline-reduction"
              onPrimary={(item) => {
                update(item.id, { reduction_status: "approved", physician_note: "Approved, treatment was necessary and charges are standard" });
                logAction("Reduction approved by Dr. Castell", "approve-reduction");
              }}
              onSecondary={(item) => {
                update(item.id, { reduction_status: "declined", physician_note: "Declined, the full balance stands" });
                logAction("Reduction declined by Dr. Castell", "decline-reduction");
              }}
            />
          ) : (
            <p className="text-sm text-[var(--pf-muted)]">Nothing is waiting for {PHYSICIAN}.</p>
          )}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="min-w-0 rounded-2xl border border-[var(--pf-primary)]/30 p-4">
          <p className="text-sm text-[var(--pf-muted)]">Open case</p>
          <h2 className="text-lg" style={headingStyle}>Case {selected.case_id}, {selected.patient_name}</h2>
          <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
            <dt className="text-[var(--pf-muted)]">Law firm</dt>
            <dd>{selected.referring_firm}, {selected.attorney_contact}</dd>
            <dt className="text-[var(--pf-muted)]">MMI</dt>
            <dd>{shortDate(selected.mmi_date)}</dd>
            <dt className="text-[var(--pf-muted)]">Visits billed</dt>
            <dd>{visitsText(selected)}</dd>
            <dt className="text-[var(--pf-muted)]">Balance due</dt>
            <dd className="font-medium">{balanceText(selected)}</dd>
            <dt className="text-[var(--pf-muted)]">Reduction</dt>
            <dd>
              {selected.reduction_requested_to !== null
                ? `Asks ${money(selected.reduction_requested_to)} in full payment, ${(selected.reduction_reason ?? "").toLowerCase()}. ${REDUCTION_LABEL[selected.reduction_status]}.`
                : "None asked"}
            </dd>
            {selected.physician_note && (
              <>
                <dt className="text-[var(--pf-muted)]">{PHYSICIAN}</dt>
                <dd><Masked field="physician_note">{selected.physician_note}</Masked></dd>
              </>
            )}
          </dl>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              data-action="prepare-final-ledger"
              onClick={prepare}
              className="min-h-[44px] rounded-lg border border-[var(--pf-primary)] px-4 py-2 text-sm font-medium text-[var(--pf-primary)]"
            >
              Prepare final itemized bill and ledger
            </button>
            <button
              type="button"
              data-action="send-reduction-to-physician"
              disabled={!canSend}
              onClick={sendReduction}
              className="min-h-[44px] rounded-lg bg-[var(--pf-primary)] px-4 py-2 text-sm font-medium text-[var(--pf-surface)] disabled:opacity-50"
            >
              Send reduction to Dr. Castell
            </button>
          </div>
          <p className="mt-2 text-xs text-[var(--pf-muted)]">{sendHint[selected.reduction_status]} Click a row below to open another case.</p>
          <div className="mt-4">
            <DocumentViewer
              title={`Final itemized bill and ledger, case ${selected.case_id}`}
              missing={selected.ledger_status === "needs final ledger"}
              lines={[
                `Prepared ${selected.ledger_prepared_on ? shortDate(selected.ledger_prepared_on) : ""} from ${selected.visits_billed} billed visits and ${ledgerPayments(selected).length} PIP payments`,
                `Total charges ${money(selected.total_charges)}`,
                `PIP paid ${money(selected.pip_paid)}`,
                `Adjustments ${money(selected.adjustments)}`,
                `Balance due ${balanceText(selected)}`,
                selected.visits_billed === selected.visits_completed
                  ? "Ledger check: every completed visit is billed"
                  : `Ledger check: ${selected.visits_completed - selected.visits_billed} visit not billed yet`,
              ]}
            />
          </div>
        </section>
        <div className="min-w-0">
          <SampleDocuments screenId="ledgers" />
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-lg" style={headingStyle}>Every case at MMI</h2>
        <p className="mt-1 text-sm text-[var(--pf-muted)]">Newest MMI first. Click a case to see its itemized bill.</p>
        <div className="mt-4">
          <DataTable
            columns={columns}
            rows={ledgers}
            rowKey={(l) => l.case_id}
            dataTour="reduction"
            rowActionId="open-ledger"
            mobileStatusKey="ledger_status"
            mobileUrgencyKey="reduction_status"
            onRowClick={(l) => {
              setSelectedId(l.case_id);
              setDrawerId(l.case_id);
              logAction("Opened ledger", "open-ledger");
            }}
          />
        </div>
      </section>

      <RecordDrawer open={!!drawer} title={drawer ? `Ledger, case ${drawer.case_id}` : ""} onClose={() => setDrawerId(null)}>
        {drawer && (
          <div className="space-y-5 text-sm">
            <p className="text-[var(--pf-muted)]">
              {drawer.patient_name}, {drawer.referring_firm}. MMI {shortDate(drawer.mmi_date)}.
            </p>
            <div>
              <h3 className="font-medium">Itemized bill</h3>
              <ul className="mt-2 divide-y divide-[var(--pf-muted)]/10">
                {ledgerLines(drawer).map((line, i) => (
                  <li key={i} className="flex justify-between gap-3 py-1">
                    <span className="min-w-0">
                      {shortDate(line.date)},{" "}
                      <Masked field="cpt_codes">{line.cpt} {CPT_LABELS[line.cpt]}</Masked>
                    </span>
                    <span>{money(line.charge)}</span>
                  </li>
                ))}
                {drawer.visits_billed < drawer.visits_completed && (
                  <li className="py-1 text-[var(--pf-muted)]">1 visit completed, not yet billed</li>
                )}
              </ul>
            </div>
            <div>
              <h3 className="font-medium">PIP payments</h3>
              <ul className="mt-2 space-y-1">
                {ledgerPayments(drawer).map((p, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>{shortDate(p.date)}</span>
                    <span>{money(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
              <dt className="text-[var(--pf-muted)]">Total charges</dt>
              <dd>{money(drawer.total_charges)}</dd>
              <dt className="text-[var(--pf-muted)]">PIP paid</dt>
              <dd>{money(drawer.pip_paid)}</dd>
              <dt className="text-[var(--pf-muted)]">Adjustments</dt>
              <dd>{money(drawer.adjustments)}</dd>
              <dt className="text-[var(--pf-muted)]">Balance due</dt>
              <dd className="font-medium">{balanceText(drawer)}</dd>
            </dl>
            <div className="rounded-xl border border-[var(--pf-muted)]/20 p-3">
              <h3 className="font-medium">Attorney's reduction request</h3>
              {drawer.reduction_requested_to !== null ? (
                <>
                  <p className="mt-1">
                    {drawer.attorney_contact} asks to settle {money(drawer.balance_due)} for {money(drawer.reduction_requested_to)}. Reason:{" "}
                    {(drawer.reduction_reason ?? "").toLowerCase()}.
                  </p>
                  <p className="mt-1 text-[var(--pf-muted)]">{REDUCTION_LABEL[drawer.reduction_status]}.</p>
                  {drawer.physician_note && (
                    <p className="mt-1">
                      {PHYSICIAN}: <Masked field="physician_note">{drawer.physician_note}</Masked>
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-1 text-[var(--pf-muted)]">None on this case.</p>
              )}
            </div>
            <p className="text-xs text-[var(--pf-muted)]">Close this to prepare the ledger or send the reduction from the open case panel.</p>
          </div>
        )}
      </RecordDrawer>
    </AppShell>
  );
}
