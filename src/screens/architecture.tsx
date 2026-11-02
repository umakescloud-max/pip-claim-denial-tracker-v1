import { AppShell, ArchitectureView, IntegrationTiles, TourRunner, type ArchEdge, type ArchNode } from "@kit";
import { NAV } from "../nav";
import tour from "../tour.json";
import { isLoggedIn, SHELL } from "./claimState";

// brief.architecture, unchanged.
const NODES: ArchNode[] = [
  {
    id: "billing-system",
    label: "Practice billing system",
    kind: "system",
    does: "Holds charges, claims and posted payments for each patient and date of service.",
    data: "Charges, CPT and diagnosis codes, payments posted",
    stores_patient_data: true,
    runs_in: "vendor-system",
  },
  {
    id: "clearinghouse",
    label: "Claim clearinghouse",
    kind: "system",
    does: "Sends claims to carriers and returns electronic remittances.",
    data: "Claims out, remittances back",
    stores_patient_data: true,
    runs_in: "vendor-system",
  },
  {
    id: "carrier-portals",
    label: "Auto carrier portals and mailed EOBs",
    kind: "external",
    does: "Carriers post EOBs, payment histories and exhaustion notices here or by mail.",
    data: "EOBs, payment histories, carrier notices",
    stores_patient_data: true,
    runs_in: "outside-party",
  },
  {
    id: "claim-tracker",
    label: "Claim tracker (this prototype)",
    kind: "app",
    does: "Matches each EOB to its claim, sorts outcomes, checks exhaustion against the limit, counts down deadlines and holds reconsiderations for approval. In this demo it runs in your browser with synthetic data.",
    data: "Claim status, denial reasons, deadlines, benefits used",
    stores_patient_data: true,
    runs_in: "client-cloud",
  },
  {
    id: "document-reader",
    label: "Document reader (AI)",
    kind: "model",
    does: "Reads scanned EOBs and carrier notices for the outcome, amounts paid and the reason given.",
    data: "EOB and notice text only, no chart notes",
    stores_patient_data: false,
    runs_in: "client-cloud",
  },
  {
    id: "billing-lead",
    label: "Joaquin (PI billing lead)",
    kind: "human",
    does: "Works denials and approves every reconsideration and LOP handoff.",
    data: "Everything in the tracker for his claims",
    stores_patient_data: false,
    runs_in: "person",
  },
  {
    id: "lien-coordinator",
    label: "Marcus (lien and LOP coordinator)",
    kind: "human",
    does: "Takes over balances once benefits are truly used up.",
    data: "Balance and claim history for handed-off claims",
    stores_patient_data: false,
    runs_in: "person",
  },
  {
    id: "adjusters",
    label: "Carrier adjusters",
    kind: "external",
    does: "Receive reconsiderations and requested records.",
    data: "Reconsideration letters and supporting records",
    stores_patient_data: false,
    runs_in: "outside-party",
  },
];

const EDGES: ArchEdge[] = [
  { from: "billing-system", to: "claim-tracker", label: "Claims and posted payments" },
  { from: "clearinghouse", to: "claim-tracker", label: "Electronic remittances" },
  { from: "carrier-portals", to: "document-reader", label: "Scanned EOBs and notices" },
  { from: "document-reader", to: "claim-tracker", label: "Outcome, amounts, reason" },
  { from: "claim-tracker", to: "billing-lead", label: "Denials, deadlines and approvals" },
  { from: "billing-lead", to: "adjusters", label: "Approved reconsiderations" },
  { from: "billing-lead", to: "lien-coordinator", label: "Exhausted balances with claim history" },
];

const COMPLIANCE_NOTES = [
  "A real build runs in the practice's own cloud account, with access limited by role and every action logged.",
  "The document reader sees EOB and notice text only, never chart notes, and patient data is never sent to a model without a signed BAA.",
  "Patient data would be stored encrypted at rest and in transit.",
  "This prototype uses synthetic data and simulated roles.",
];

// What the tracker takes over from today's workflow.
const REPLACES = [
  "The EOB outcome spreadsheet tab",
  "The hand-sorted deadline tab",
  "Free-text adjuster call notes",
  "LOP handoff emails",
];

export default function Architecture() {
  return (
    <AppShell {...SHELL} nav={NAV}>
      <h1 className="text-3xl" style={{ fontFamily: "var(--pf-font-heading)" }}>How it works</h1>
      <p className="mt-2 max-w-2xl text-[var(--pf-muted)]">
        Where each piece would run, what data passes through it and which parts hold patient data. Click a box for
        details.
      </p>
      <div className="mt-6">
        <ArchitectureView nodes={NODES} edges={EDGES} complianceNotes={COMPLIANCE_NOTES} />
      </div>
      <div className="mt-8 max-w-3xl">
        <IntegrationTiles tools={REPLACES} title="What it replaces" />
      </div>
      {isLoggedIn() && <TourRunner steps={tour} storageKey="pf-tour-pip-claim-denial-tracker-v1" />}
    </AppShell>
  );
}
