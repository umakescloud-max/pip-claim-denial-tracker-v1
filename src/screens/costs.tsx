import { AppShell, SavingsCalculator } from "@kit";
import { NAV } from "../nav";
import { SHELL, headingStyle } from "./lib";

// Costs: what this work costs with people today versus with the tool. SavingsCalculator reads the brief's costs.
export default function Costs() {
  return (
    <AppShell {...SHELL} nav={NAV}>
      <h1 className="text-2xl" style={headingStyle}>What working PIP claims costs today</h1>
      <p className="mt-2 max-w-2xl text-[var(--pf-muted)]">Put in your own numbers. Nothing you type leaves this page.</p>
      <div className="mt-6">
        <SavingsCalculator />
      </div>
    </AppShell>
  );
}
