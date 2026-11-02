import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell, OneClickLogin, StoryPanel, TaskList, TourRunner, startTour, useActivity } from "@kit";
import { NAV } from "../nav";
import tour from "../tour.json";
import { isLoggedIn, LOGIN_KEY, SHELL } from "./claimState";

const PAIN_POINTS = [
  "No single list of open PIP claims with their status, carrier and deadline",
  "Appeal and timely filing deadlines live in a hand-sorted spreadsheet tab, so one missed re-sort can lose a claim",
  "Carrier exhaustion notices are accepted at face value without checking how much of the benefit limit was actually paid",
  "Balances move to the LOP side with no claim history attached, so the lien coordinator has to ask for it",
];

export default function Story() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn);
  const navigate = useNavigate();
  const { logAction } = useActivity();

  if (!loggedIn) {
    return (
      <OneClickLogin
        personaName="Joaquin Reyes"
        personaRole="PI billing lead"
        practiceName="Larkfield Injury & Spine Group"
        onLogin={() => {
          try {
            window.localStorage.setItem(LOGIN_KEY, "1");
          } catch {
            // Private browsing: stay logged in for this visit only.
          }
          setLoggedIn(true);
        }}
      />
    );
  }

  return (
    <AppShell {...SHELL} nav={NAV}>
      <h1 className="text-3xl" style={{ fontFamily: "var(--pf-font-heading)" }}>Start here</h1>
      <p className="mt-2 max-w-2xl text-[var(--pf-muted)]">
        For a PI billing lead at an injury-first multi-specialty practice paid mostly through PIP, letters of
        protection and workers' comp, who works every claim from submission to payment, denial or handoff.
      </p>
      <div className="mt-6 max-w-3xl">
        <TaskList tour={tour} />
      </div>
      <div className="mt-4 flex max-w-3xl flex-wrap items-center gap-3">
        <p className="text-sm text-[var(--pf-muted)]">Rather see everything in order?</p>
        <button
          type="button"
          data-action="take-full-tour"
          onClick={() => {
            logAction("Tour started", "take-full-tour");
            startTour(tour, navigate);
          }}
          className="min-h-[44px] rounded-lg border border-[var(--pf-primary)] px-4 py-2 text-sm font-medium text-[var(--pf-primary)]"
        >
          Take the full tour
        </button>
      </div>
      <section className="mt-12 max-w-3xl">
        <h2 className="text-xl" style={{ fontFamily: "var(--pf-font-heading)" }}>Why this exists</h2>
        <div className="mt-4">
          <StoryPanel
            practiceName="Larkfield Injury & Spine Group"
            practiceType="Injury-first multi-specialty practice: orthopedics, spine, interventional pain, physiatry and physical therapy, paid mostly through PIP, letters of protection and workers' comp"
            personaName="Joaquin"
            dayInTheLife="Joaquin starts at 7:30am with 38 EOBs pulled from five auto carriers' portals overnight and 12 paper EOBs the front desk scanned on Friday. For each one he finds the claim in the billing system, types the outcome into a spreadsheet tab, and copies denials to a second tab he re-sorts by appeal deadline by hand. Adjusters start answering at 9:00. By noon he has worked 31 of the 50, and he still has to decide which exhausted-benefit balances go to Marcus Odum for the LOP side."
            painPoints={PAIN_POINTS}
            costOfPain="About 14 minutes per claim or remittance at 140 a week is roughly 33 billing hours a week. One wrongly accepted exhaustion notice moves $1,860 from a payment due in weeks to a lien that waits a median of about 440 days for settlement."
            before="Monday, 7:30am. Joaquin works 50 EOBs one by one into the spreadsheet. At 11:20 he reaches claim 5208 (L. Barrientos, rear-end collision, neck sprain, six physical therapy visits) from Harborline Auto Insurance, denied as benefits exhausted. He emails Marcus to move the $1,240 to the LOP. Nobody adds up the carrier's payments, which come to $8,140 of a $10,000 limit, and the 30-day window to dispute it closes on Friday."
            after="Monday, 7:30am. Joaquin opens the claim tracker. 41 of the 50 EOBs are already sorted into paid, underpaid and denied. Claim 5208 sits at the top of Denials, flagged 'Exhausted per carrier, limit not reached', with a countdown showing 4 days to the appeal deadline. He attaches the carrier's payment history, moves the claim to review, reads the reconsideration and approves it. The adjuster has it before 9:00, and the balance stays on the PIP side."
            onStartTour={() => startTour(tour, navigate)}
          />
        </div>
      </section>
      <TourRunner steps={tour} storageKey="pf-tour-pip-claim-denial-tracker-v1" />
    </AppShell>
  );
}
