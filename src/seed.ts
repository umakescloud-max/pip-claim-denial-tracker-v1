// PIP claims and adjuster contacts for Larkfield Injury & Spine Group, generated
// deterministically from the demo slug. Every date comes from rel() or
// addBusinessDays(), so "today" in the demo is always the visitor's today.
import { addBusinessDays, createNameGenerator, fakeName, pickOne, randomInt, rel, rng, shuffle } from "@kit";

export type ClaimStatus =
  | "Paid"
  | "Pending"
  | "Underpaid"
  | "Denied"
  | "Records requested"
  | "In reconsideration"
  | "Handed to LOP";

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
  submitted_date: Date | null;
  accepted_first_pass: boolean;
  eob_date: Date | null;
  appeal_deadline: Date | null;
  timely_filing_deadline: Date;
  benefit_limit: number;
  benefits_paid_to_date: number;
  next_follow_up: Date | null;
}

export interface AdjusterContact {
  id: string;
  claim_id: string;
  contact_date: Date;
  contact_by: string;
  channel: string;
  outcome: string;
  next_action_date: Date | null;
}

export type ReviewKind = "reconsideration" | "lop-handoff";
export interface ReviewItem {
  claim_id: string;
  kind: ReviewKind;
}

export const EDGE_CASE_ID = "5208";
export const EDGE_CASE_LABEL = "Exhausted per carrier, limit not reached";

export const CARRIERS = [
  { name: "Harborline Auto Insurance", prefix: "HAI" },
  { name: "Corvane Mutual Auto", prefix: "CMA" },
  { name: "Pinewell Casualty", prefix: "PWC" },
  { name: "Ostley General Auto", prefix: "OGA" },
  { name: "Bramblecote Insurance", prefix: "BCI" },
] as const;

export const REFERRING_FIRMS = [
  "Fenwright & Sallow Injury Law",
  "Marrow Creek Trial Lawyers",
  "Quillby Hart Accident Attorneys",
  "Dunmore & Pell Injury Group",
  "Tolliver Ashcombe Law",
];

// Real CPT codes with plain-language labels of our own (the kit catalog's where it has them).
export const CPT_LABELS: Record<string, string> = {
  "99203": "New patient visit",
  "99213": "Follow-up visit",
  "97110": "Therapeutic exercise session",
  "97140": "Manual therapy session",
  "72148": "MRI of the lower back (no contrast)",
  "64483": "Spinal injection for nerve pain",
};

export const DIAGNOSIS_LABELS: Record<string, string> = {
  "S13.4XXA": "Neck sprain, first visit",
  "S33.5XXA": "Low back sprain, first visit",
  "S16.1XXA": "Neck muscle strain, first visit",
  "M54.12": "Cervical radiculopathy",
};

export const REASONS = {
  records: "Records requested",
  claimNumber: "Carrier claim number missing",
  modifier: "Modifier missing",
  underpaid: "Underpaid against fee schedule",
  exhausted: "Benefits exhausted per carrier",
} as const;

export const BILLING_ASSISTANT = "Nell Okonjo";
const PERSONA = "Joaquin Reyes";

const rand = rng("pip-claim-denial-tracker");
const patients = createNameGenerator(rand);
const initialName = (full: string) => {
  const [first, ...rest] = full.split(" ");
  return `${first[0]}. ${rest.join(" ")}`;
};
const roundTo = (n: number, step: number) => Math.round(n / step) * step;
const DAY = 86_400_000;

const SERVICE_MIXES: { cpt: string[]; visits: [number, number]; billed: [number, number] }[] = [
  { cpt: ["99203"], visits: [1, 1], billed: [180, 320] },
  { cpt: ["99213"], visits: [1, 2], billed: [180, 360] },
  { cpt: ["97110", "97140"], visits: [3, 8], billed: [540, 1600] },
  { cpt: ["72148"], visits: [1, 1], billed: [950, 1450] },
  { cpt: ["64483"], visits: [1, 1], billed: [1800, 2600] },
  { cpt: ["99213", "97110"], visits: [2, 4], billed: [420, 980] },
];

// Status counts across the 160 claims (about 58% paid, 14% pending, 8% underpaid,
// 9% denied, 4% records requested, 3% in reconsideration, 4% handed to LOP).
const NEWEST_GROUP = 30;
const newestStatuses: ClaimStatus[] = [...Array(20).fill("Pending"), ...Array(10).fill("Paid")];
const olderStatuses: ClaimStatus[] = [
  ...Array(83).fill("Paid"),
  ...Array(2).fill("Pending"),
  ...Array(13).fill("Underpaid"),
  ...Array(13).fill("Denied"), // plus claim 5208
  ...Array(6).fill("Records requested"),
  ...Array(5).fill("In reconsideration"),
  ...Array(7).fill("Handed to LOP"),
];

const ids = Array.from({ length: 160 }, (_, i) => 5100 + i);
const shuffledNewest = shuffle(rand, newestStatuses);
const shuffledOlder = shuffle(rand, olderStatuses);
const deniedReasons = shuffle(rand, [
  ...Array(5).fill(REASONS.claimNumber),
  ...Array(4).fill(REASONS.modifier),
  ...Array(4).fill(REASONS.exhausted),
]) as string[];
const reconReasons = shuffle(rand, [REASONS.claimNumber, REASONS.modifier, REASONS.underpaid, REASONS.records, REASONS.underpaid]) as string[];

function buildClaim(id: number, index: number): Claim {
  const claim_id = String(id);
  const isEdge = claim_id === EDGE_CASE_ID;
  // Oldest claim (5100) about 120 days back, newest (5259) about today.
  const dosOffset = -Math.max(0, Math.round(120 - index * 0.75) + randomInt(rand, -1, 1));
  const carrier = isEdge ? CARRIERS[0] : pickOne(rand, CARRIERS);
  const isNewest = index >= 160 - NEWEST_GROUP;
  let claim_status: ClaimStatus = isEdge ? "Denied" : isNewest ? shuffledNewest.pop()! : shuffledOlder.pop()!;

  const mix = isEdge ? SERVICE_MIXES[2] : pickOne(rand, SERVICE_MIXES);
  const visits = isEdge ? 6 : randomInt(rand, mix.visits[0], mix.visits[1]);
  const billed_amount = isEdge ? 1240 : roundTo(randomInt(rand, mix.billed[0], mix.billed[1]), 10);
  const diagnosis_codes = isEdge
    ? ["S13.4XXA"]
    : shuffle(rand, Object.keys(DIAGNOSIS_LABELS)).slice(0, randomInt(rand, 1, 2));

  const date_of_service = rel(dosOffset, "10:00");
  const date_of_loss = rel(dosOffset - randomInt(rand, 6, 40), "08:00");
  const submitOffset = dosOffset + randomInt(rand, 2, 9);
  let submitted_date: Date | null = submitOffset <= 0 ? rel(submitOffset, "16:00") : null;
  if (!submitted_date) claim_status = "Pending";

  const benefit_limit = isEdge ? 10000 : rand() < 0.15 ? 25000 : 10000;
  let benefits_paid_to_date = isEdge
    ? 8140
    : roundTo(randomInt(rand, Math.round(benefit_limit * 0.08), Math.round(benefit_limit * 0.82)), 10);

  let denial_reason: string | null = null;
  if (isEdge) denial_reason = EDGE_CASE_LABEL;
  else if (claim_status === "Denied") denial_reason = deniedReasons.pop()!;
  else if (claim_status === "Underpaid") denial_reason = REASONS.underpaid;
  else if (claim_status === "Records requested") denial_reason = REASONS.records;
  else if (claim_status === "In reconsideration") denial_reason = reconReasons.pop()!;
  else if (claim_status === "Handed to LOP") denial_reason = REASONS.exhausted;
  // A legitimate exhaustion has used every dollar of the limit.
  if (denial_reason === REASONS.exhausted) benefits_paid_to_date = benefit_limit;

  let paid_amount = 0;
  if (claim_status === "Paid") paid_amount = roundTo(billed_amount * (0.72 + rand() * 0.16), 1);
  if (claim_status === "Underpaid") paid_amount = roundTo(billed_amount * (0.38 + rand() * 0.2), 1);

  const accepted_first_pass =
    submitted_date !== null &&
    denial_reason !== REASONS.claimNumber &&
    denial_reason !== REASONS.modifier &&
    rand() < 0.95;

  const hasEob = submitted_date !== null && claim_status !== "Pending";
  const eobOffset = Math.min(-1, submitOffset + randomInt(rand, 8, 24));
  const eob_date = hasEob ? rel(eobOffset, "11:00") : null;
  const appeal_deadline =
    hasEob && claim_status !== "Paid" ? new Date(eob_date!.getTime() + 30 * DAY) : null;

  const open = ["Pending", "Underpaid", "Denied", "Records requested", "In reconsideration"].includes(claim_status);
  return {
    claim_id,
    case_id: `LK-${2400 + (id % 97) * 7 + index}`,
    patient_name: isEdge ? "L. Barrientos" : initialName(patients.next()),
    date_of_loss,
    carrier: carrier.name,
    claim_number: `${carrier.prefix}-DEMO-5${claim_id}`,
    adjuster_name: fakeName(rand),
    referring_firm: isEdge ? REFERRING_FIRMS[0] : pickOne(rand, REFERRING_FIRMS),
    date_of_service,
    visits,
    cpt_codes: mix.cpt,
    diagnosis_codes,
    billed_amount,
    paid_amount,
    claim_status,
    denial_reason,
    submitted_date,
    accepted_first_pass,
    eob_date,
    appeal_deadline,
    timely_filing_deadline: rel(dosOffset + 365, "17:00"),
    benefit_limit,
    benefits_paid_to_date,
    next_follow_up: open ? rel(randomInt(rand, 1, 10), "09:00") : null,
  };
}

const built = ids.map((id, i) => buildClaim(id, i));

// Open denials: claim 5208's deadline is 4 business days out; four others fall
// within 7 days; the rest are 9 to 29 days away. An EOB never post-dates today.
const OPEN_DENIAL: ClaimStatus[] = ["Denied", "Underpaid", "Records requested"];
const openDenials = built.filter((c) => OPEN_DENIAL.includes(c.claim_status));
// Deadlines always fall on a business day.
const nearBusinessDays = [1, 2, 3, 5];
openDenials
  .filter((c) => c.claim_id !== EDGE_CASE_ID)
  .forEach((c, i) => {
    if (i < nearBusinessDays.length) {
      c.appeal_deadline = addBusinessDays(rel(0, "17:00"), nearBusinessDays[i]);
    } else {
      // The EOB comes at least 3 days after submission, and the deadline is 30 days after the EOB.
      const daysSinceSubmit = Math.floor((rel(0, "00:00").getTime() - c.submitted_date!.getTime()) / DAY);
      const earliest = 30 - daysSinceSubmit + 3;
      const offset = Math.max(9, earliest, randomInt(rand, 9, 27));
      c.appeal_deadline = addBusinessDays(rel(offset - 1, "17:00"), 1);
    }
    c.eob_date = new Date(c.appeal_deadline.getTime() - 30 * DAY);
  });
const edge = built.find((c) => c.claim_id === EDGE_CASE_ID)!;
edge.appeal_deadline = addBusinessDays(rel(0, "17:00"), 4);
edge.eob_date = new Date(edge.appeal_deadline.getTime() - 30 * DAY);
edge.next_follow_up = rel(1, "09:00");

/** Every PIP claim, newest date of service first. */
export const claims: Claim[] = [...built].sort((a, b) => b.date_of_service.getTime() - a.date_of_service.getTime());

/** The Denials list: claim 5208 first, then the rest by days left to the deadline. */
export const denials: Claim[] = [
  edge,
  ...openDenials
    .filter((c) => c.claim_id !== EDGE_CASE_ID)
    .sort((a, b) => a.appeal_deadline!.getTime() - b.appeal_deadline!.getTime()),
];

/** Waiting for Joaquin's approval when the demo opens: two reconsiderations and two exhausted balances. */
export const reviewQueueSeed: ReviewItem[] = [
  ...denials.filter((c) => c.claim_status === "Underpaid").slice(0, 2).map((c) => ({ claim_id: c.claim_id, kind: "reconsideration" as const })),
  ...denials.filter((c) => c.denial_reason === REASONS.exhausted).slice(0, 2).map((c) => ({ claim_id: c.claim_id, kind: "lop-handoff" as const })),
];

const OUTCOMES_OPEN = [
  "Adjuster confirmed claim in review",
  "Left voicemail for adjuster",
  "Records sent by fax",
  "Adjuster asked for the itemized bill",
  "Portal message sent asking for claim status",
];
const CHANNELS = ["Phone", "Portal message", "Fax"];

function buildContacts(): AdjusterContact[] {
  const out: AdjusterContact[] = [];
  let n = 0;
  const push = (claim_id: string, offset: number, outcome: string, by?: string, channel?: string) => {
    out.push({
      id: `ac-${++n}`,
      claim_id,
      contact_date: rel(offset, `${randomInt(rand, 9, 16)}:${pickOne(rand, ["05", "20", "35", "50"])}` as `${number}:${number}`),
      contact_by: by ?? (rand() < 0.6 ? PERSONA : BILLING_ASSISTANT),
      channel: channel ?? pickOne(rand, CHANNELS),
      outcome,
      next_action_date: outcome.startsWith("Payment issued") ? null : rel(offset + randomInt(rand, 3, 10), "09:00"),
    });
  };
  for (const c of built) {
    if (c.claim_id === EDGE_CASE_ID) {
      push(c.claim_id, -2, "EOB received, denied as benefits exhausted", PERSONA, "Portal message");
      push(c.claim_id, -1, "Left voicemail for adjuster", PERSONA, "Phone");
      continue;
    }
    const sinceSubmit = c.submitted_date ? Math.floor((c.submitted_date.getTime() - rel(0, "00:00").getTime()) / DAY) : 0;
    if (c.claim_status === "Paid") {
      push(c.claim_id, Math.min(-1, sinceSubmit + randomInt(rand, 6, 14)), "Payment issued, check in mail");
      continue;
    }
    if (!c.submitted_date) continue;
    const count = randomInt(rand, 1, 3);
    for (let i = 0; i < count; i++) {
      const offset = Math.min(-1, sinceSubmit + 3 + i * randomInt(rand, 3, 6));
      push(c.claim_id, offset, pickOne(rand, OUTCOMES_OPEN));
    }
  }
  return out.sort((a, b) => a.contact_date.getTime() - b.contact_date.getTime());
}

export const adjusterContacts: AdjusterContact[] = buildContacts();
