import { AppShell, SavingsCalculator, TourRunner } from "@kit";
import { NAV } from "../nav";
import tour from "../tour.json";
import { isLoggedIn, SHELL } from "./claimState";

// Costs: what this work costs with people today versus with the tool. SavingsCalculator reads the brief's costs.
export default function Costs() {
  return (
    <AppShell {...SHELL} nav={NAV}>
      <h1 className="text-3xl" style={{ fontFamily: "var(--pf-font-heading)" }}>What working PIP claims costs today</h1>
      <p className="mt-2 max-w-2xl text-[var(--pf-muted)]">Put in your own numbers. Nothing you type leaves this page.</p>
      <div className="mt-6">
        <SavingsCalculator />
      </div>
      {isLoggedIn() && <TourRunner steps={tour} storageKey="pf-tour-pip-claim-denial-tracker-v1" />}
    </AppShell>
  );
}
