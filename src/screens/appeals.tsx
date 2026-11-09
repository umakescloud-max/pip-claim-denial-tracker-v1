import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ApprovalQueue, AppShell, AuditLog, DocumentViewer, rel, useActivity, useDemo, useDemoState, type ApprovalItem } from "@kit";
import { NAV } from "../nav";
import { BILLING_LEAD, CLAIMS, CONTACTS, EDGE_CLAIM_ID, EDGE_LABEL, EDGE_PAYMENTS, LOP_COORDINATOR, type Claim, type Contact } from "../seed";
import { SHELL, daysLeftText, headingStyle, money, shortDate } from "./lib";

export default function Appeals() {
  const { logAction, auditLog } = useActivity();
  const { config } = useDemo();
  const [claims, setClaims] = useDemoState<Claim[]>("claims", CLAIMS);
  const [contacts, setContacts] = useDemoState<Contact[]>("contacts", CONTACTS);

  const queue = useMemo(
    () => claims.filter((c) => c.review).sort((a, b) => (b.review_since?.getTime() ?? 0) - (a.review_since?.getTime() ?? 0)),
    [claims]
  );
  const edge = claims.find((c) => c.claim_id === EDGE_CLAIM_ID)!;
  const sampleTitle = config.samples.find((s) => s.record_id === EDGE_CLAIM_ID)?.title;
  const edgeHistory = edge.payment_history_attached || (!!sampleTitle && auditLog.some((e) => e.text === `Read sample: ${sampleTitle}`));
  const top = queue[0];

  const items: ApprovalItem[] = queue.map((c) => {
    const left = c.benefit_limit - c.benefits_paid_to_date;
    return c.review === "reconsideration"
      ? {
          id: c.claim_id,
          title: `Claim ${c.claim_id}, ${c.patient_name}: reconsideration to ${c.carrier}`,
          subtitle: `${c.denial_reason}. ${money(c.benefits_paid_to_date)} paid of ${money(c.benefit_limit)}, ${money(left)} left.${c.appeal_deadline ? ` Appeal deadline ${shortDate(c.appeal_deadline)}, ${daysLeftText(c.appeal_deadline).toLowerCase()}.` : ""}`,
          edgeCase: c.claim_id === EDGE_CLAIM_ID,
        }
      : {
          id: c.claim_id,
          title: `Claim ${c.claim_id}, ${c.patient_name}: hand ${money(c.billed_amount - c.paid_amount)} to ${LOP_COORDINATOR}`,
          subtitle: `${c.carrier} says benefits are used up, and its payments do reach the limit: ${money(c.benefits_paid_to_date)} of ${money(c.benefit_limit)}. Referred by ${c.referring_firm}.`,
          edgeCase: c.claim_id === EDGE_CLAIM_ID,
        };
  });

  const decide = (id: string, patch: Partial<Claim>, outcome: string) => {
    const now = new Date();
    setClaims((prev) => prev.map((c) => (c.claim_id === id ? { ...c, ...patch, review: null, review_since: null } : c)));
    setContacts((prev) => [
      ...prev,
      { id: `review-${now.getTime()}`, claim_id: id, contact_date: now, contact_by: BILLING_LEAD, channel: "Fax", outcome, next_action_date: rel(10) },
    ]);
  };

  const letter = (c: Claim): string[] => {
    const attached = c.claim_id === EDGE_CLAIM_ID ? edgeHistory : c.payment_history_attached;
    const left = c.benefit_limit - c.benefits_paid_to_date;
    if (c.review === "lop-handoff")
      return [
        `To: ${LOP_COORDINATOR}, lien and LOP coordinator`,
        `Patient ${c.patient_name}, case ${c.case_id}, referred by ${c.referring_firm}`,
        `Balance to carry on the LOP: ${money(c.billed_amount - c.paid_amount)}`,
        `${c.carrier} paid ${money(c.benefits_paid_to_date)} of the ${money(c.benefit_limit)} PIP limit, so the exhaustion notice checks out.`,
        `Claim history attached: submission, EOBs, ${contacts.filter((x) => x.claim_id === c.claim_id).length} adjuster contacts and payments posted.`,
      ];
    return [
      `To: the claims adjuster, ${c.carrier}`,
      `Re: carrier claim ${c.claim_number}, patient ${c.patient_name}, date of loss ${shortDate(c.date_of_loss)}`,
      c.claim_id === EDGE_CLAIM_ID
        ? `We ask you to reconsider the denial of ${c.visits} physical therapy visits billed at ${money(c.billed_amount)} as benefits exhausted.`
        : `We ask you to reconsider the denial for ${c.denial_reason?.toLowerCase()} on ${money(c.billed_amount)} billed.`,
      c.denial_reason === EDGE_LABEL
        ? `Your own payment history shows ${money(c.benefits_paid_to_date)} paid against the ${money(c.benefit_limit)} PIP limit, leaving ${money(left)}. The ${money(c.billed_amount)} billed fits within what is left.`
        : "The corrected claim and the itemized bill are attached.",
      attached ? "Attached: your payment history on this claim." : "Not attached yet: the carrier's payment history.",
      `Prepared for ${BILLING_LEAD}, PI billing lead, Larkfield Injury & Spine Group`,
    ];
  };

  return (
    <AppShell {...SHELL} nav={NAV}>
      <h1 className="text-2xl" style={headingStyle}>Review</h1>
      <p className="mt-2 max-w-2xl text-[var(--pf-muted)]">
        Reconsiderations and exhausted-benefit handoffs wait here for your approval. Nothing goes to a carrier's adjuster or to{" "}
        {LOP_COORDINATOR} until you click.
      </p>
      {!edge.review && edge.claim_status === "denied" && (
        <p className="mt-4 max-w-2xl rounded-lg bg-[var(--pf-accent)]/40 px-3 py-2 text-sm">
          Claim {EDGE_CLAIM_ID} shows up here once you move it to reconsideration review.{" "}
          <Link to="/denials" className="underline">Open it on Denials</Link>
        </p>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="min-w-0">
          <h2 className="text-lg" style={headingStyle}>Waiting for your approval ({queue.length})</h2>
          <div className="mt-4">
            {items.length > 0 ? (
              <ApprovalQueue
                items={items}
                dataTour="approval-queue"
                primaryLabel="Approve and send to adjuster"
                secondaryLabel="Hand balance to LOP coordinator"
                primaryActionId="approve-and-send-reconsideration"
                secondaryActionId="hand-to-lop"
                onPrimary={(item) => {
                  decide(item.id, { claim_status: "in reconsideration", next_follow_up: rel(10) }, "Reconsideration sent to adjuster");
                  logAction("Reconsideration approved and sent to the adjuster", "approve-and-send-reconsideration");
                }}
                onSecondary={(item) => {
                  decide(item.id, { claim_status: "handed to LOP", next_follow_up: null }, `Balance and claim history sent to ${LOP_COORDINATOR}`);
                  logAction("Balance handed to the LOP coordinator with claim history", "hand-to-lop");
                }}
              />
            ) : (
              <p className="text-sm text-[var(--pf-muted)]">Nothing is waiting. Claims you move to reconsideration review on Denials land here.</p>
            )}
          </div>
        </section>

        <section className="min-w-0 space-y-4">
          <h2 className="text-lg" style={headingStyle}>{top ? `Read before you approve: claim ${top.claim_id}` : "Read before you approve"}</h2>
          {top ? (
            <>
              <DocumentViewer
                title={top.review === "lop-handoff" ? `Handoff to ${LOP_COORDINATOR}, claim ${top.claim_id}` : `Drafted reconsideration letter, claim ${top.claim_id}`}
                lines={letter(top)}
              />
              {top.denial_reason === EDGE_LABEL && (
                <DocumentViewer
                  title={`Carrier payment history, claim ${top.claim_id}`}
                  missing={!edgeHistory}
                  lines={[
                    ...EDGE_PAYMENTS.map((p) => `${shortDate(p.date)}: ${money(p.amount)}, ${p.covers.toLowerCase()}`),
                    `Paid to date ${money(top.benefits_paid_to_date)} of ${money(top.benefit_limit)}, ${money(top.benefit_limit - top.benefits_paid_to_date)} left`,
                  ]}
                />
              )}
            </>
          ) : (
            <p className="text-sm text-[var(--pf-muted)]">The letter for the item at the top of the queue shows here.</p>
          )}
          <div>
            <h2 className="text-lg" style={headingStyle}>What has been decided</h2>
            <div className="mt-3">
              <AuditLog />
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
