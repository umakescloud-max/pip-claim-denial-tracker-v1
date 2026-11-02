# PIP claim and denial tracker for an injury practice

Every PIP claim tracked from submission to payment, with denials sorted by reason and appeal deadlines counted down.

![PIP claim and denial tracker for an injury practice](cover.png)

## Who has this problem

Injury-first practices paid mostly through PIP, letters of protection and workers' comp. The PI billing lead gets carrier EOBs through portals, the clearinghouse and paper mail. They match each one to its claim, type the outcome into a spreadsheet, and re-sort a second tab of appeal deadlines by hand. When a carrier says benefits are exhausted, the balance usually goes to the LOP coordinator with no one checking how much of the limit was actually paid, and no claim history attached.

At about 14 minutes per claim or remittance and 140 a week, that comes to roughly 33 billing hours a week. One wrongly accepted exhaustion notice can move $1,860 from a payment due in weeks to a lien that waits a median of about 440 days for settlement.

## What you can try

- **Open the newest claim:** on Claims, click the top row to open that claim's page.
- **Check the exhaustion denial:** on Denials, open claim 5208, attach the carrier payment history, then click Move to reconsideration review. The carrier says benefits are exhausted, but its own payments total $8,140 of a $10,000 limit, with 4 days left to appeal.
- **Approve the reconsideration:** on Review, read the drafted letter for claim 5208 and click Approve and send to adjuster.

**Sample document:** a carrier payment history for claim 5208 is included, so you can attach it without your own file.

**Role switcher:** view the app as the PI billing lead, the lien and LOP coordinator, or an attorney. Each role hides the fields it should not see.

**Cost calculator:** put in your own weekly claim volume, minutes per claim and billing rate to compare today's time with the tracker.

**How it works:** a clickable diagram. Click any box to see what it does, what data passes through it and whether it stores patient data.

## How it's built

A browser-only React + TypeScript + Tailwind app built on the Umakes kit, running on synthetic seed data: 160 PIP claims from five invented auto carriers and 240 adjuster contacts. Nothing leaves your browser. The app was built and checked by the Umakes App Factory, with automated gates plus a reviewer that uses the app the way a visitor would. The architecture screen shows how a real version fits together: the practice billing system, the claim clearinghouse, carrier portals and mailed EOBs, a document reader for scanned EOBs, and the people who approve each step.

## What a production version adds

- Real integrations with the practice billing system, the claim clearinghouse, and carrier portals and mailed EOBs.
- An AI document reader for scanned EOBs and carrier notices that sees notice text only, never chart notes.
- HIPAA controls: access limited by role, audit logs on every action, encryption at rest and in transit, and signed BAAs before any patient data reaches a model.
- Deployment on the practice's own cloud (GCP).
- The practice owns the code, the data and the deployment.

## Try it

https://umakescloud-max.github.io/pip-claim-denial-tracker-v1/

This is a concept prototype built on synthetic data. The practice, the people and the claims are invented. A real build runs on the client's own cloud, HIPAA-ready, and the client owns it.

If your team fights this every week, book a free workflow audit at umakes.cloud or reply to umakescloud@gmail.com.
