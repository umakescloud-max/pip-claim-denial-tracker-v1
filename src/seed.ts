// Synthetic seed data for the PIP claim and denial tracker. Every date comes from rel(), every "random" choice from
// rng(), so the same demo always shows the same claims, relative to today.
import { CPT_CODES, createNameGenerator, fakePhone, randomInt, rel, rng, shuffle } from "@kit";

export type ClaimStatus =
  | "paid"
  | "pending"
  | "underpaid"
  | "denied"
  | "records requested"
  | "in reconsideration"
  | "handed to LOP";

export type ReviewKind = "reconsideration" | "lop-handoff";

export interface Claim {
  claim_id: string;
  case_id: string;
  patient_name: string;
  date_of_loss: Date;
  carrier: string;
  claim_number: string;
  adjuster_name: string;
  referring_firm: string;
  date_of_service: Date;
  visits: number;
  cpt_codes: string[];
  diagnosis_codes: string[];
  billed_amount: number;
  paid_amount: number;
  claim_status: ClaimStatus;
  denial_reason: string | null;
  denial_date: Date | null;
  payment_date: Date | null;
  submitted_date: Date | null;
  accepted_first_pass: boolean;
  receipt_confirmed: boolean;
  receipt_date: Date | null;
  appeal_deadline: Date | null;
  timely_filing_deadline: Date;
  benefit_limit: number;
  benefits_paid_to_date: number;
  next_follow_up: Date | null;
  payment_history_attached: boolean;
  review: ReviewKind | null;
  review_since: Date | null;
}

export interface Contact {
  id: string;
  claim_id: string;
  contact_date: Date;
  contact_by: string;
  channel: "Phone" | "Portal message" | "Fax";
  outcome: string;
  next_action_date: Date;
}

export type LedgerStatus = "needs final ledger" | "final ledger prepared" | "sent to attorney";
export type ReductionStatus = "none" | "received" | "awaiting physician" | "approved" | "declined";

export interface Ledger {
  case_id: string;
  patient_name: string;
  referring_firm: string;
  attorney_contact: string;
  mmi_date: Date;
  visits_completed: number;
  visits_billed: number;
  total_charges: number;
  pip_paid: number;
  adjustments: number;
  balance_due: number;
  ledger_status: LedgerStatus;
  ledger_prepared_on: Date | null;
  reduction_requested_to: number | null;
  reduction_reason: string | null;
  reduction_status: ReductionStatus;
  physician_note: string | null;
}

export const EDGE_CLAIM_ID = "5208";
export const EDGE_LABEL = "Exhausted per carrier, limit not reached";
export const REDUCTION_CASE_ID = "3312";
export const PHYSICIAN = "Dr. Castell";
export const LOP_COORDINATOR = "Marcus Odum";
export const BILLING_LEAD = "Joaquin Reyes";

export const CARRIERS = [
  { name: "Harborline Auto Insurance", prefix: "HAI" },
  { name: "Corvane Mutual Auto", prefix: "CMA" },
  { name: "Pinewell Casualty", prefix: "PWC" },
  { name: "Ostley General Auto", prefix: "OGA" },
  { name: "Bramblecote Insurance", prefix: "BCI" },
] as const;

export const FIRMS = [
  "Fenwright & Sallow Injury Law",
  "Marrow Creek Trial Lawyers",
  "Halberd Point Injury Attorneys",
  "Quillby & Dunmore Law",
  "Stonereach Accident Law",
];

export const DIAGNOSES: Record<string, string> = {
  "S13.4XXA": "Neck sprain",
  "S33.5XXA": "Low back sprain",
  "S16.1XXA": "Neck muscle strain",
  "M54.12": "Cervical radiculopathy",
};

// CPT codes come from the kit catalog with the kit's own labels.
const CPT_USED = ["97110", "72148", "64483", "73030", "20610"];
export const CPT_LABELS: Record<string, string> = Object.fromEntries(
  CPT_CODES.filter((c) => CPT_USED.includes(c.code)).map((c) => [c.code, c.label])
);

export const DENIAL_REASONS = [
  "Records requested",
  "Carrier claim number missing",
  "Modifier missing",
  "Underpaid against fee schedule",
  "Benefits exhausted per carrier",
  EDGE_LABEL,
];

/** Harborline's own payment history on claim 5208's case: what the carrier paid before calling the limit used up. */
export const EDGE_PAYMENTS: { date: Date; amount: number; covers: string }[] = [
  { date: rel(-62), amount: 2480, covers: "Initial evaluation and cervical imaging" },
  { date: rel(-55), amount: 1960, covers: "Physical therapy, first block of visits" },
  { date: rel(-48), amount: 1850, covers: "Physical therapy, second block of visits" },
  { date: rel(-41), amount: 1850, covers: "Physical therapy, third block of visits" },
];

const round10 = (n: number) => Math.round(n / 10) * 10;
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const minDate = (a: Date, b: Date) => (a.getTime() < b.getTime() ? a : b);
const initialName = (full: string) => {
  const [first, ...rest] = full.split(" ");
  return `${first[0]}. ${rest.join(" ")}`;
};

interface CaseInfo {
  case_id: string;
  patient_name: string;
  date_of_loss: Date;
  carrier: (typeof CARRIERS)[number];
  adjuster_name: string;
  referring_firm: string;
  diagnosis_codes: string[];
  benefit_limit: number;
  benefits_paid_to_date: number;
  exhausted: boolean;
}

function buildClaims(): { claims: Claim[]; contacts: Contact[] } {
  const rand = rng("pip-claim-denial-tracker-claims");
  const people = createNameGenerator(rand);
  const adjusters: Record<string, string[]> = {};
  for (const c of CARRIERS) adjusters[c.name] = [people.next(), people.next()];
  const assistant = people.next();

  // Cases outside the MMI ledger range (3300-3335), several claims each.
  const caseIds: number[] = [];
  for (let i = 3200; i <= 3399; i++) if ((i < 3300 || i > 3335) && i !== 3241) caseIds.push(i);
  const cases: CaseInfo[] = shuffle(rand, caseIds)
    .slice(0, 56)
    .sort((a, b) => a - b)
    .map((id) => {
      const carrier = CARRIERS[randomInt(rand, 0, CARRIERS.length - 1)];
      const limit = rand() < 0.15 ? 25000 : 10000;
      const dx = shuffle(rand, Object.keys(DIAGNOSES)).slice(0, randomInt(rand, 1, 2));
      return {
        case_id: String(id),
        patient_name: initialName(people.next()),
        date_of_loss: rel(-randomInt(rand, 125, 220)),
        carrier,
        adjuster_name: adjusters[carrier.name][randomInt(rand, 0, 1)],
        referring_firm: FIRMS[randomInt(rand, 0, FIRMS.length - 1)],
        diagnosis_codes: dx,
        benefit_limit: limit,
        benefits_paid_to_date: round10(randomInt(rand, 900, Math.round(limit * 0.8))),
        exhausted: false,
      };
    });

  // Statuses for the 159 claims other than 5208, in the brief's proportions.
  type Plan = { status: ClaimStatus; reason: string | null };
  const plans: Plan[] = [
    ...Array.from({ length: 93 }, () => ({ status: "paid" as const, reason: null })),
    ...Array.from({ length: 22 }, () => ({ status: "pending" as const, reason: null })),
    ...Array.from({ length: 13 }, () => ({ status: "underpaid" as const, reason: "Underpaid against fee schedule" })),
    ...Array.from({ length: 5 }, () => ({ status: "denied" as const, reason: "Carrier claim number missing" })),
    ...Array.from({ length: 5 }, () => ({ status: "denied" as const, reason: "Modifier missing" })),
    ...Array.from({ length: 3 }, () => ({ status: "denied" as const, reason: "Benefits exhausted per carrier" })),
    ...Array.from({ length: 6 }, () => ({ status: "records requested" as const, reason: "Records requested" })),
    { status: "in reconsideration", reason: "Carrier claim number missing" },
    { status: "in reconsideration", reason: "Modifier missing" },
    { status: "in reconsideration", reason: "Modifier missing" },
    { status: "in reconsideration", reason: "Underpaid against fee schedule" },
    { status: "in reconsideration", reason: "Records requested" },
    ...Array.from({ length: 7 }, () => ({ status: "handed to LOP" as const, reason: "Benefits exhausted per carrier" })),
  ];
  const shuffled = shuffle(rand, plans);

  // Appeal deadlines on open denials: only five fall within 7 days (5208 at 4 days is the fifth).
  const openCount = shuffled.filter((p) => ["underpaid", "denied", "records requested"].includes(p.status)).length;
  const deadlineOffsets = shuffle(rand, [
    1, 2, 6, 7,
    ...Array.from({ length: openCount - 4 }, () => randomInt(rand, 9, 29)),
  ]);
  let pendingOld = 0;
  let unconfirmed = 0;

  const claims: Claim[] = [];
  const contacts: Contact[] = [];
  let contactSeq = 0;
  const addContact = (claim_id: string, date: Date, channel: Contact["channel"], outcome: string, next: Date, by?: string) =>
    contacts.push({
      id: `c${++contactSeq}`,
      claim_id,
      contact_date: date,
      contact_by: by ?? (rand() < 0.6 ? BILLING_LEAD : assistant),
      channel,
      outcome,
      next_action_date: next,
    });

  let planIndex = 0;
  for (let id = 5100; id <= 5259; id++) {
    if (String(id) === EDGE_CLAIM_ID) continue;
    const plan = shuffled[planIndex++];
    const kase = cases[randomInt(rand, 0, cases.length - 1)];
    const isExhaustion = plan.reason === "Benefits exhausted per carrier";
    if (isExhaustion) kase.exhausted = true;

    let dos: Date;
    let submitted: Date | null;
    let denial: Date | null = null;
    let payment: Date | null = null;
    let deadline: Date | null = null;
    if (plan.status === "paid") {
      const dosOff = -randomInt(rand, 22, 118);
      const subOff = dosOff + randomInt(rand, 2, 9);
      dos = rel(dosOff);
      submitted = rel(subOff);
      payment = rel(Math.min(-1, subOff + randomInt(rand, 12, 35)));
    } else if (plan.status === "pending") {
      const old = pendingOld < 7 && rand() < 0.45;
      if (old) pendingOld++;
      const dosOff = old ? -randomInt(rand, 45, 118) : -randomInt(rand, 1, 28);
      const subOff = dosOff + randomInt(rand, 2, 9);
      dos = rel(dosOff);
      submitted = subOff < 0 ? rel(subOff) : null;
    } else if (["underpaid", "denied", "records requested"].includes(plan.status)) {
      const dlOff = deadlineOffsets.pop() ?? 20;
      const denialOff = dlOff - 30;
      const subOff = denialOff - randomInt(rand, 8, 20);
      deadline = rel(dlOff);
      denial = rel(denialOff);
      submitted = rel(subOff);
      dos = rel(subOff - randomInt(rand, 2, 9));
    } else {
      // in reconsideration, handed to LOP
      const denialOff = -randomInt(rand, 15, 60);
      const subOff = denialOff - randomInt(rand, 8, 20);
      denial = rel(denialOff);
      deadline = rel(denialOff + 30);
      submitted = rel(subOff);
      dos = rel(subOff - randomInt(rand, 2, 9));
    }

    const billed = round10(randomInt(rand, 180, 2600));
    const paid =
      plan.status === "paid"
        ? round10(billed * (0.8 + rand() * 0.2))
        : plan.status === "underpaid"
          ? round10(billed * (0.45 + rand() * 0.25))
          : 0;
    const visits = Math.max(1, Math.round(billed / randomInt(rand, 180, 320)));
    const cpt = shuffle(rand, CPT_USED).slice(0, randomInt(rand, 1, 3));
    if (!cpt.includes("97110") && visits > 2) cpt[0] = "97110";
    const firstPass =
      plan.reason === "Carrier claim number missing" || plan.reason === "Modifier missing"
        ? plan.status === "in reconsideration" && rand() < 0.3
        : !(plan.status === "paid" && rand() < 0.07);
    const isOldPending = plan.status === "pending" && submitted !== null && submitted.getTime() < rel(-30).getTime();
    let receiptConfirmed = submitted !== null;
    if (isOldPending && unconfirmed < 6) {
      receiptConfirmed = false;
      unconfirmed++;
    }
    const open = !["paid", "handed to LOP"].includes(plan.status);
    const nextFollowUp = open ? rel(randomInt(rand, -3, 10)) : null;

    const claim: Claim = {
      claim_id: String(id),
      case_id: kase.case_id,
      patient_name: kase.patient_name,
      date_of_loss: kase.date_of_loss,
      carrier: kase.carrier.name,
      claim_number: `${kase.carrier.prefix}-DEMO-5${id}`,
      adjuster_name: kase.adjuster_name,
      referring_firm: kase.referring_firm,
      date_of_service: dos,
      visits,
      cpt_codes: cpt,
      diagnosis_codes: kase.diagnosis_codes,
      billed_amount: billed,
      paid_amount: paid,
      claim_status: plan.status,
      denial_reason: plan.reason,
      denial_date: denial,
      payment_date: payment,
      submitted_date: submitted,
      accepted_first_pass: submitted !== null && firstPass,
      receipt_confirmed: receiptConfirmed,
      receipt_date: receiptConfirmed && submitted ? minDate(addDays(submitted, randomInt(rand, 1, 4)), rel(0)) : null,
      appeal_deadline: deadline,
      timely_filing_deadline: addDays(dos, 180),
      benefit_limit: kase.benefit_limit,
      benefits_paid_to_date: 0,
      next_follow_up: nextFollowUp,
      payment_history_attached: false,
      review: null,
      review_since: null,
    };
    claims.push(claim);

    // Adjuster contacts: the last one on an open claim sets its next follow-up.
    const ch = (): Contact["channel"] => (["Phone", "Portal message", "Fax"] as const)[randomInt(rand, 0, 2)];
    if (submitted) {
      const outcomes: Record<ClaimStatus, string[]> = {
        paid: ["Payment issued, check in mail", "Adjuster confirmed claim in review"],
        pending: ["Adjuster confirmed claim in review", "Left voicemail", "Carrier has no record of the bill, resent"],
        underpaid: ["Adjuster confirmed payment was cut to the fee schedule", "Left voicemail"],
        denied: ["EOB received, denial confirmed by adjuster", "Left voicemail", "Adjuster confirmed claim in review"],
        "records requested": ["Records sent by fax", "Adjuster asked for therapy notes", "Left voicemail"],
        "in reconsideration": ["Reconsideration sent to adjuster", "Adjuster confirmed claim in review"],
        "handed to LOP": ["Carrier confirmed benefits exhausted", "Balance and claim history sent to Marcus Odum"],
      };
      const n = open ? randomInt(rand, 1, 3) : randomInt(rand, 0, 2);
      const lastOff = nextFollowUp ? Math.round((nextFollowUp.getTime() - rel(0).getTime()) / 86400000) - randomInt(rand, 3, 10) : -randomInt(rand, 1, 10);
      const earliest = Math.round((submitted.getTime() - rel(0).getTime()) / 86400000) + 1;
      const offsets: number[] = [];
      for (let k = 0; k < n; k++) offsets.unshift(lastOff - k * randomInt(rand, 4, 9));
      offsets.forEach((off, k) => {
        if (off < earliest || off > -1) return;
        const isLast = k === offsets.length - 1;
        const nextDate = isLast && nextFollowUp ? nextFollowUp : rel(off + randomInt(rand, 3, 10));
        addContact(claim.claim_id, rel(off, `${randomInt(rand, 8, 16)}:${randomInt(rand, 10, 55)}` as `${number}:${number}`), ch(), outcomes[plan.status][k % outcomes[plan.status].length], nextDate);
      });
    }
  }

  // Case-level benefits used: exhausted cases are at the limit, the rest below it.
  const byCase = new Map(cases.map((c) => [c.case_id, c]));
  for (const c of claims) {
    const kase = byCase.get(c.case_id)!;
    c.benefits_paid_to_date = kase.exhausted ? kase.benefit_limit : kase.benefits_paid_to_date;
  }

  // Three items already waiting on Review: two real exhaustions for the LOP side, one modifier fix to reconsider.
  const exhaustedDenied = claims.filter((c) => c.claim_status === "denied" && c.denial_reason === "Benefits exhausted per carrier");
  const modifier = claims.find((c) => c.claim_status === "denied" && c.denial_reason === "Modifier missing");
  const queued: [Claim | undefined, ReviewKind, Date][] = [
    [exhaustedDenied[0], "lop-handoff", rel(-1, "16:20")],
    [modifier, "reconsideration", rel(-2, "11:05")],
    [exhaustedDenied[1], "lop-handoff", rel(-3, "09:40")],
  ];
  for (const [c, kind, since] of queued) {
    if (!c) continue;
    c.review = kind;
    c.review_since = since;
  }

  // Claim 5208, the edge case.
  const edge: Claim = {
    claim_id: EDGE_CLAIM_ID,
    case_id: "3241",
    patient_name: "L. Barrientos",
    date_of_loss: rel(-70),
    carrier: "Harborline Auto Insurance",
    claim_number: "HAI-DEMO-55208",
    adjuster_name: adjusters["Harborline Auto Insurance"][0],
    referring_firm: "Fenwright & Sallow Injury Law",
    date_of_service: rel(-46),
    visits: 6,
    cpt_codes: ["97110"],
    diagnosis_codes: ["S13.4XXA"],
    billed_amount: 1240,
    paid_amount: 0,
    claim_status: "denied",
    denial_reason: EDGE_LABEL,
    denial_date: rel(-26),
    payment_date: null,
    submitted_date: rel(-40),
    accepted_first_pass: true,
    receipt_confirmed: true,
    receipt_date: rel(-37),
    appeal_deadline: rel(4),
    timely_filing_deadline: addDays(rel(-46), 180),
    benefit_limit: 10000,
    benefits_paid_to_date: EDGE_PAYMENTS.reduce((s, p) => s + p.amount, 0),
    next_follow_up: rel(0),
    payment_history_attached: false,
    review: null,
    review_since: null,
  };
  addContact(EDGE_CLAIM_ID, rel(-2, "10:15"), "Portal message", "EOB received, denied as benefits exhausted", rel(1), BILLING_LEAD);
  addContact(EDGE_CLAIM_ID, rel(-1, "14:40"), "Phone", "Left voicemail for adjuster", rel(0), BILLING_LEAD);

  // Seed order: 5208 first, then the other open denials by appeal deadline, then everything else by claim id.
  const isOpenDenial = (c: Claim) => ["underpaid", "denied", "records requested"].includes(c.claim_status);
  const openDenials = claims.filter(isOpenDenial).sort((a, b) => a.appeal_deadline!.getTime() - b.appeal_deadline!.getTime());
  const rest = claims.filter((c) => !isOpenDenial(c));
  return { claims: [edge, ...openDenials, ...rest], contacts };
}

function buildLedgers(): Ledger[] {
  const rand = rng("pip-claim-denial-tracker-ledgers");
  const people = createNameGenerator(rand);
  const ids = Array.from({ length: 36 }, (_, i) => 3300 + i).filter((id) => String(id) !== REDUCTION_CASE_ID);
  // 35 ledgers besides 3312: needs 11, prepared 6, sent 18.
  const ledgerStatuses = shuffle(rand, [
    ...Array.from({ length: 11 }, () => "needs final ledger" as const),
    ...Array.from({ length: 6 }, () => "final ledger prepared" as const),
    ...Array.from({ length: 18 }, () => "sent to attorney" as const),
  ]);
  // Reductions only on prepared or sent ledgers: received 2, awaiting 4, approved 4, declined 3.
  const reductionPool = shuffle(rand, [
    ...Array.from({ length: 2 }, () => "received" as const),
    ...Array.from({ length: 4 }, () => "awaiting physician" as const),
    ...Array.from({ length: 4 }, () => "approved" as const),
    ...Array.from({ length: 3 }, () => "declined" as const),
  ]);
  const unbilled = new Set(shuffle(rand, ids).slice(0, 3));
  const eligible = ids.filter((_, i) => ledgerStatuses[i] !== "needs final ledger");
  const withReduction = new Map(shuffle(rand, eligible).slice(0, reductionPool.length).map((id, i) => [id, reductionPool[i]]));
  const reasons = ["Policy limits settlement", "Client's net recovery", "Disputed liability"];
  const approvedNotes = ["Approved, treatment was necessary and charges are standard", "Approved, client's recovery is small against the bill"];
  const declinedNotes = ["Declined, balance already reduced once", "Declined, charges match the fee schedule"];

  const ledgers: Ledger[] = ids.map((id, i) => {
    const status = ledgerStatuses[i];
    const visits = randomInt(rand, 8, 30);
    const total = Math.min(32000, Math.max(3800, round10(visits * randomInt(rand, 380, 1050))));
    const limit = rand() < 0.15 ? 25000 : 10000;
    const pip = Math.min(limit, round10(total * (0.55 + rand() * 0.35)));
    const adjustments = round10(randomInt(rand, 0, 900));
    const balance = Math.max(0, total - pip - adjustments);
    const reduction: ReductionStatus = withReduction.get(id) ?? "none";
    const requested = reduction === "none" ? null : round10(balance * (0.6 + rand() * 0.2));
    const mmiOff = -randomInt(rand, 1, 45);
    const contact = `${people.next()}, ${fakePhone(rand)}`;
    return {
      case_id: String(id),
      patient_name: initialName(people.next()),
      referring_firm: FIRMS[randomInt(rand, 0, FIRMS.length - 1)],
      attorney_contact: contact,
      mmi_date: rel(mmiOff),
      visits_completed: visits,
      visits_billed: unbilled.has(id) ? visits - 1 : visits,
      total_charges: total,
      pip_paid: pip,
      adjustments,
      balance_due: balance,
      ledger_status: status,
      ledger_prepared_on: status === "needs final ledger" ? null : rel(Math.min(-1, mmiOff + randomInt(rand, 1, 6))),
      reduction_requested_to: requested,
      reduction_reason: reduction === "none" ? null : reasons[randomInt(rand, 0, reasons.length - 1)],
      reduction_status: reduction,
      physician_note:
        reduction === "approved"
          ? approvedNotes[randomInt(rand, 0, 1)]
          : reduction === "declined"
            ? declinedNotes[randomInt(rand, 0, 1)]
            : null,
    };
  });

  ledgers.push({
    case_id: REDUCTION_CASE_ID,
    patient_name: "T. Mwangi",
    referring_firm: "Marrow Creek Trial Lawyers",
    attorney_contact: `${people.next()}, ${fakePhone(rand)}`,
    mmi_date: rel(-6),
    visits_completed: 22,
    visits_billed: 22,
    total_charges: 14620,
    pip_paid: 10000,
    adjustments: 0,
    balance_due: 4620,
    ledger_status: "final ledger prepared",
    ledger_prepared_on: rel(-4),
    reduction_requested_to: 3000,
    reduction_reason: "Policy limits settlement",
    reduction_status: "received",
    physician_note: null,
  });
  // Newest MMI first.
  return ledgers.sort((a, b) => b.mmi_date.getTime() - a.mmi_date.getTime());
}

export interface LedgerLine {
  date: Date;
  cpt: string;
  charge: number;
}

/** The itemized bill behind a ledger: one line per billed visit, charges adding up to total_charges. */
export function ledgerLines(l: Ledger): LedgerLine[] {
  const rand = rng(`ledger-lines-${l.case_id}`);
  const base: Record<string, number> = { "97110": 180, "72148": 1450, "64483": 2100, "73030": 160, "20610": 420 };
  const codes = Array.from({ length: l.visits_billed }, (_, i) =>
    i === 1 ? "72148" : i % 7 === 4 ? "64483" : i === 0 ? "73030" : i % 9 === 8 ? "20610" : "97110"
  );
  const raw = codes.map((c) => base[c]);
  const scale = l.total_charges / raw.reduce((s, n) => s + n, 0);
  const charges = raw.map((n) => round10(n * scale));
  charges[charges.length - 1] += l.total_charges - charges.reduce((s, n) => s + n, 0);
  const span = l.visits_billed * randomInt(rand, 3, 5);
  return codes.map((cpt, i) => ({
    date: addDays(l.mmi_date, -span + Math.round((i * span) / Math.max(1, l.visits_billed - 1)) - 1),
    cpt,
    charge: charges[i],
  }));
}

/** PIP payments posted on a ledger case, adding up to pip_paid. */
export function ledgerPayments(l: Ledger): { date: Date; amount: number }[] {
  const rand = rng(`ledger-payments-${l.case_id}`);
  const n = randomInt(rand, 3, 5);
  const parts = Array.from({ length: n }, () => round10(l.pip_paid / n));
  parts[n - 1] += l.pip_paid - parts.reduce((s, x) => s + x, 0);
  const lines = ledgerLines(l);
  const first = lines[0]?.date ?? l.mmi_date;
  const span = Math.max(10, Math.round((l.mmi_date.getTime() - first.getTime()) / 86400000));
  return parts.map((amount, i) => ({ date: minDate(addDays(first, Math.round(((i + 1) * span) / (n + 1)) + 14), rel(-1)), amount }));
}

const built = buildClaims();
export const CLAIMS: Claim[] = built.claims;
export const CONTACTS: Contact[] = built.contacts;
export const LEDGERS: Ledger[] = buildLedgers();
