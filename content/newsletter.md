## The exhaustion notice nobody adds up

At an injury practice, PIP claims come back through carrier portals, the clearinghouse and paper mail. A PI billing lead matches each EOB to its claim, logs the outcome in a spreadsheet and re-sorts a deadline tab by hand. At about 14 minutes per claim or remittance and 140 a week, that is roughly 33 billing hours a week.

There is no single list of open claims with status, carrier and deadline. One missed re-sort of the deadline tab can lose a claim. And when a carrier says benefits are exhausted, the notice is usually taken at face value. The balance goes to the LOP coordinator, often with no claim history attached.

A wrongly accepted exhaustion notice moves money from a payment due in weeks to a lien that can wait a median of about 440 days for settlement.

## What the prototype does

We built a PIP claim and denial tracker to show a different Monday.

**Claims.** Every PIP claim in one list, newest first, with carrier, date of service, billed and paid amounts, benefits used and status. Above it: first-pass acceptance, deadlines in the next 7 days, insurance A/R over 90 days and balances handed to LOP. Click a row to open the claim.

**Denials.** Denied, underpaid and records-requested claims, each with the reason and a countdown to its appeal or filing deadline. Claim 5208 is pinned at the top. The carrier denied six physical therapy visits, billed at $1,240, as benefits exhausted. Its own payments total $8,140 of a $10,000 limit, so $1,860 is left. The tracker flags it "Exhausted per carrier, limit not reached," with 4 days to the appeal deadline. You attach the carrier payment history (a sample document is included) and move the claim to reconsideration review.

**Review.** The drafted reconsideration letter waits here. Nothing goes to an adjuster, and no balance goes to the LOP coordinator, until the billing lead clicks to approve it.

You can also switch roles, try the cost calculator with your own numbers, and click through the "How it works" diagram.

## How a real version would be built

A production build connects to the practice billing system, the clearinghouse and carrier portals, with a document reader for scanned EOBs that never sees chart notes. It runs on the practice's own cloud with access by role, audit logs, encryption at rest and in transit, and signed BAAs.

This is a concept prototype with synthetic data. A real build runs on your own cloud, HIPAA-ready, and you own it.

If your team fights this every week, book a free workflow audit at umakes.cloud or reply to umakescloud@gmail.com.
