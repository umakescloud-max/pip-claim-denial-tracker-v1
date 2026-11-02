# Decisions
- Countdowns use business days (kit `businessDaysBetween`); claim 5208's appeal deadline is 4 business days out, and every seeded deadline falls on a business day.
- Moving a denial to review does not change its claim_status; only the approval on Review (the human checkpoint) does. The Denials row shows a separate "Waiting for approval" pill meanwhile.
- The Review queue opens with two underpaid reconsiderations and two exhausted-benefit handoffs, so it is never empty on a fresh visit; claim 5208 joins at the top only after the visitor moves it.
- The "Attach carrier payment history" button appears only in claim 5208's drawer, because its toast names claim 5208. Using the sample document also counts as attaching it.
- Shared hooks and constants live in src/screens/claimState.ts (.ts, so App.tsx's screens glob does not route it).
- Visitor changes are stored as overlays in useDemoState (status changes, review queue, added contacts) with numeric timestamps, so the kit's ISO-date reviver cannot turn them into Date objects.
- IntegrationTiles on How it works lists what the tracker replaces (the brief names no tools).
- Each claim has its own case_id and adjuster; claims do not share a case.
