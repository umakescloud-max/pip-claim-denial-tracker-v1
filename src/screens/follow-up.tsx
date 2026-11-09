import { useMemo, useState } from "react";
import { AppShell, DataTable, Masked, RecordDrawer, StatusPill, formatDateTime, rel, useActivity, useDemoState, type DataTableColumn } from "@kit";
import { NAV } from "../nav";
import { BILLING_LEAD, CLAIMS, CONTACTS, type Claim, type Contact } from "../seed";
import { OPEN_DENIAL, SHELL, claimStatusLabel, claimStatusTone, daysFromToday, followUpText, headingStyle, money, shortDate } from "./lib";

const needsFollowUp = (c: Claim) =>
  OPEN_DENIAL.includes(c.claim_status) ||
  (c.claim_status === "pending" && !!c.submitted_date && daysFromToday(c.submitted_date) < -30 && c.paid_amount === 0);

export default function FollowUp() {
  const { logAction } = useActivity();
  const [claims, setClaims] = useDemoState<Claim[]>("claims", CLAIMS);
  const [contacts, setContacts] = useDemoState<Contact[]>("contacts", CONTACTS);
  const [openId, setOpenId] = useState<string | null>(null);

  const lastContact = (id: string) => {
    const list = contacts.filter((c) => c.claim_id === id).sort((a, b) => a.contact_date.getTime() - b.contact_date.getTime());
    return list;
  };

  const rows = useMemo(
    () =>
      claims
        .filter(needsFollowUp)
        .slice()
        .sort((a, b) => (a.next_follow_up?.getTime() ?? 0) - (b.next_follow_up?.getTime() ?? 0)),
    [claims]
  );
  const overdue = rows.filter((c) => c.next_follow_up && daysFromToday(c.next_follow_up) < 0).length;
  const open = rows.find((c) => c.claim_id === openId) ?? null;

  const update = (id: string, patch: Partial<Claim>) =>
    setClaims((prev) => prev.map((c) => (c.claim_id === id ? { ...c, ...patch } : c)));

  const confirmReceipt = (c: Claim) => {
    const now = new Date();
    update(c.claim_id, { receipt_confirmed: true, receipt_date: now });
    setContacts((prev) => [
      ...prev,
      { id: `receipt-${now.getTime()}`, claim_id: c.claim_id, contact_date: now, contact_by: BILLING_LEAD, channel: "Phone", outcome: "Carrier confirmed receipt of the bill", next_action_date: c.next_follow_up ?? rel(7) },
    ]);
    logAction("Carrier receipt confirmed on the claim", "confirm-receipt");
  };

  const setNext = (c: Claim) => {
    update(c.claim_id, { next_follow_up: rel(7) });
    logAction("Next follow-up date set on the claim", "set-next-follow-up");
  };

  const columns: DataTableColumn<Claim>[] = [
    {
      key: "claim_id",
      header: "Claim",
      render: (c) => (
        <span>
          <span className="font-medium">{c.claim_id}</span> <span className="text-[var(--pf-muted)]">{c.patient_name}</span>
        </span>
      ),
    },
    { key: "carrier", header: "Carrier", render: (c) => c.carrier },
    { key: "open_balance", field: "paid_amount", header: "Open balance", render: (c) => money(c.billed_amount - c.paid_amount) },
    {
      key: "receipt_confirmed",
      header: "Carrier receipt",
      render: (c) => (c.receipt_confirmed && c.receipt_date ? `Confirmed ${shortDate(c.receipt_date)}` : "Not confirmed"),
    },
    { key: "adjuster_name", header: "Adjuster", render: (c) => c.adjuster_name },
    {
      key: "last_contact",
      header: "Last contact",
      render: (c) => {
        const last = lastContact(c.claim_id).slice(-1)[0];
        return last ? `${shortDate(last.contact_date)}, ${last.outcome}` : "None yet";
      },
    },
    { key: "next_follow_up", header: "Next follow-up", render: (c) => (c.next_follow_up ? `${followUpText(c.next_follow_up)}, ${shortDate(c.next_follow_up)}` : "Not set") },
    { key: "claim_status", header: "Status", render: (c) => <StatusPill label={claimStatusLabel(c)} tone={claimStatusTone(c)} /> },
  ];

  const recent = open ? lastContact(open.claim_id).slice(-2).reverse() : [];

  return (
    <AppShell {...SHELL} nav={NAV}>
      <h1 className="text-2xl" style={headingStyle}>Follow-up</h1>
      <p className="mt-2 max-w-2xl text-[var(--pf-muted)]">
        Denied, underpaid and records-requested claims, plus pending claims submitted more than 30 days ago with no payment.
        Oldest next follow-up first.
      </p>
      <p className="mt-4 text-sm">
        <span className="font-medium">{rows.length} claims</span> need a call or a check;{" "}
        <span className="rounded bg-[var(--pf-accent)] px-1.5 py-0.5 text-[var(--pf-ink)]">{overdue} overdue</span>. Click a row to work it.
      </p>
      <div className="mt-6">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(c) => c.claim_id}
          rowActionId="open-follow-up"
          mobileStatusKey="claim_status"
          mobileUrgencyKey="next_follow_up"
          onRowClick={(c) => {
            setOpenId(c.claim_id);
            logAction("Opened follow-up", "open-follow-up");
          }}
        />
      </div>

      <RecordDrawer open={!!open} title={open ? `Follow-up on claim ${open.claim_id}` : ""} onClose={() => setOpenId(null)}>
        {open && (
          <div className="space-y-5 text-sm">
            <p className="text-[var(--pf-muted)]">
              {open.patient_name}, {open.carrier}, adjuster <Masked field="adjuster_name">{open.adjuster_name}</Masked>
            </p>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
              <dt className="text-[var(--pf-muted)]">Open balance</dt>
              <dd className="font-medium"><Masked field="paid_amount">{money(open.billed_amount - open.paid_amount)}</Masked></dd>
              <dt className="text-[var(--pf-muted)]">Billed and paid</dt>
              <dd>
                <Masked field="billed_amount">{money(open.billed_amount)}</Masked> billed,{" "}
                <Masked field="paid_amount">{money(open.paid_amount)}</Masked> paid
              </dd>
              <dt className="text-[var(--pf-muted)]">Carrier receipt</dt>
              <dd>{open.receipt_confirmed && open.receipt_date ? `Confirmed ${shortDate(open.receipt_date)}` : "Not confirmed"}</dd>
              <dt className="text-[var(--pf-muted)]">Next follow-up</dt>
              <dd>{open.next_follow_up ? `${shortDate(open.next_follow_up)} (${followUpText(open.next_follow_up).toLowerCase()})` : "Not set"}</dd>
            </dl>
            <div>
              <h3 className="font-medium">Last two adjuster contacts</h3>
              {recent.length === 0 ? (
                <p className="mt-1 text-[var(--pf-muted)]">No contacts logged yet.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {recent.map((c) => (
                    <li key={c.id} className="rounded-lg border border-[var(--pf-muted)]/20 p-3">
                      <p className="text-xs text-[var(--pf-muted)]">{formatDateTime(c.contact_date)}, {c.channel.toLowerCase()}, {c.contact_by}</p>
                      <p className="mt-1">{c.outcome}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                data-action="confirm-receipt"
                onClick={() => confirmReceipt(open)}
                className="min-h-[44px] rounded-lg border border-[var(--pf-primary)] px-4 py-2 font-medium text-[var(--pf-primary)]"
              >
                Confirm carrier receipt
              </button>
              <button
                type="button"
                data-action="set-next-follow-up"
                onClick={() => setNext(open)}
                className="min-h-[44px] rounded-lg bg-[var(--pf-primary)] px-4 py-2 font-medium text-[var(--pf-surface)]"
              >
                Set next follow-up date
              </button>
            </div>
            <p className="text-xs text-[var(--pf-muted)]">Setting the next follow-up puts it 7 days out, on {shortDate(rel(7))}, and moves the claim down the queue.</p>
          </div>
        )}
      </RecordDrawer>
    </AppShell>
  );
}
