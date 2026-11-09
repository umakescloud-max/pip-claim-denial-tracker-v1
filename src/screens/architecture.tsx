import { AppShell, ArchitectureView, IntegrationTiles, type ArchEdge, type ArchNode } from "@kit";
import { NAV } from "../nav";
import { SHELL, headingStyle } from "./lib";

// brief.architecture, copied unchanged.
const NODES: ArchNode[] = [
  {
    "id": "billing-system",
    "label": "Practice billing system (Practice Mate)",
    "kind": "system",
    "does": "Holds charges, claims, posted payments, adjustments and the patient account ledger for each case.",
    "data": "Charges, CPT and diagnosis codes, payments and adjustments posted",
    "stores_patient_data": true,
    "runs_in": "vendor-system"
  },
  {
    "id": "clearinghouse",
    "label": "Claim clearinghouse (Office Ally)",
    "kind": "system",
    "does": "Sends claims to carriers and returns electronic remittances.",
    "data": "Claims out, remittances back",
    "stores_patient_data": true,
    "runs_in": "vendor-system"
  },
  {
    "id": "carrier-portals",
    "label": "Auto carrier portals and mailed EOBs",
    "kind": "external",
    "does": "Carriers post EOBs, payment histories and exhaustion notices here or by mail.",
    "data": "EOBs, payment histories, carrier notices",
    "stores_patient_data": true,
    "runs_in": "outside-party"
  },
  {
    "id": "claim-tracker",
    "label": "Claim tracker (this prototype)",
    "kind": "app",
    "does": "Matches each EOB to its claim, sorts outcomes, checks exhaustion against the limit, counts down deadlines, queues follow-ups, builds final ledgers at MMI and holds reconsiderations and reductions for approval. In this demo it runs in your browser with synthetic data.",
    "data": "Claim status, denial reasons, deadlines, benefits used, ledgers, reduction requests",
    "stores_patient_data": true,
    "runs_in": "client-cloud"
  },
  {
    "id": "document-reader",
    "label": "Document reader (AI)",
    "kind": "model",
    "does": "Reads scanned EOBs, carrier notices and attorney reduction letters for the outcome, amounts and the reason given.",
    "data": "EOB, notice and letter text only, no chart notes",
    "stores_patient_data": false,
    "runs_in": "client-cloud"
  },
  {
    "id": "billing-lead",
    "label": "Joaquin (PI billing lead)",
    "kind": "human",
    "does": "Works follow-ups and denials, prepares final ledgers, and approves every reconsideration and LOP handoff.",
    "data": "Everything in the tracker for his claims",
    "stores_patient_data": false,
    "runs_in": "person"
  },
  {
    "id": "physician",
    "label": "Dr. Castell (treating physiatrist)",
    "kind": "human",
    "does": "Approves or declines every attorney reduction request before the practice answers.",
    "data": "Verified balance, final ledger and the attorney's request",
    "stores_patient_data": false,
    "runs_in": "person"
  },
  {
    "id": "lien-coordinator",
    "label": "Marcus (lien and LOP coordinator)",
    "kind": "human",
    "does": "Takes over balances once benefits are truly used up.",
    "data": "Balance and claim history for handed-off claims",
    "stores_patient_data": false,
    "runs_in": "person"
  },
  {
    "id": "adjusters",
    "label": "Carrier adjusters",
    "kind": "external",
    "does": "Receive reconsiderations and requested records.",
    "data": "Reconsideration letters and supporting records",
    "stores_patient_data": false,
    "runs_in": "outside-party"
  },
  {
    "id": "law-firms",
    "label": "Referring law firms",
    "kind": "external",
    "does": "Ask for final ledgers and reductions, and receive itemized bills and reduction decisions.",
    "data": "Final itemized bills, ledgers, reduction decisions",
    "stores_patient_data": false,
    "runs_in": "outside-party"
  }
];

const EDGES: ArchEdge[] = [
  {
    "from": "billing-system",
    "to": "claim-tracker",
    "label": "Claims, payments and ledgers"
  },
  {
    "from": "clearinghouse",
    "to": "claim-tracker",
    "label": "Electronic remittances"
  },
  {
    "from": "carrier-portals",
    "to": "document-reader",
    "label": "Scanned EOBs and notices"
  },
  {
    "from": "law-firms",
    "to": "document-reader",
    "label": "Reduction request letters"
  },
  {
    "from": "document-reader",
    "to": "claim-tracker",
    "label": "Outcome, amounts, reason"
  },
  {
    "from": "claim-tracker",
    "to": "billing-lead",
    "label": "Follow-ups, denials, deadlines and approvals"
  },
  {
    "from": "claim-tracker",
    "to": "physician",
    "label": "Reduction requests with verified balance"
  },
  {
    "from": "physician",
    "to": "claim-tracker",
    "label": "Approve or decline"
  },
  {
    "from": "billing-lead",
    "to": "adjusters",
    "label": "Approved reconsiderations"
  },
  {
    "from": "billing-lead",
    "to": "lien-coordinator",
    "label": "Exhausted balances with claim history"
  },
  {
    "from": "billing-lead",
    "to": "law-firms",
    "label": "Final itemized bill, ledger and reduction decision"
  }
];

const COMPLIANCE_NOTES: string[] = [
  "A real build runs in the practice's own cloud account, with access limited by role and every action logged.",
  "The document reader sees EOB, notice and letter text only, never chart notes, and patient data is never sent to a model without a signed BAA.",
  "No reduction is recorded or sent to an attorney without the physician's approval, and each decision is kept in the audit log.",
  "Patient data would be stored encrypted at rest and in transit.",
  "This prototype uses synthetic data and simulated roles."
];

export default function Architecture() {
  return (
    <AppShell {...SHELL} nav={NAV}>
      <h1 className="text-2xl" style={headingStyle}>How it works</h1>
      <p className="mt-2 max-w-2xl text-[var(--pf-muted)]">
        Where each piece would run, what data passes through it and which parts hold patient data. Click a box to see what it does.
      </p>
      <div className="mt-6">
        <ArchitectureView nodes={NODES} edges={EDGES} complianceNotes={COMPLIANCE_NOTES} />
      </div>
      <div className="mt-8 max-w-xl">
        <IntegrationTiles tools={["Office Ally", "Practice Mate"]} title="Tools the practice already uses" />
      </div>
    </AppShell>
  );
}
