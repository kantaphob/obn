# YouTube functional audit — 2026-10-21

Scope: code review of overview, groups, membership, billing, collections, cashbook, permissions and activity logs, plus read-only database reconciliation. No end-to-end mutation tests were run and no business records changed during this audit.

## Current data reconciliation

- 3 groups, 14 directory members, 54 receipts, 82 activity log records.
- Every receipt has a linked cashbook entry. No amount/date differences between those receipts and their ledger entries were found.
- No duplicate receipt for the same seat and due date was found.
- Recorded receipts: THB 4,408.02; supplier expenses: THB 3,990.00; balance: THB 418.02.
- Historical receipts reconstructed earlier use current account prices/cycles. Their notes disclose reconstruction; these are owner-confirmed records, not independently verified bank statements.

## Functional coverage

| Area | Implemented | Limitation |
|---|---|---|
| Overview | Due collection queue, pending supplier charges, actual monthly income/expense, balance | Due amount represents one next unpaid round per seat, not every overdue round |
| Groups | Create/edit/delete, package price, start, billing day, six seats, notebook | Group edits submit all seats; no historical package prices |
| Members | Contact CRUD, name/email/phone/Line/Facebook/Instagram, multiple seats | Email-account lifecycle is intentionally restricted in member APIs; member names are globally unique |
| Membership | Add/change/remove person per slot; optional account email | No join/leave dates or immutable assignment history |
| Pricing | Monthly allocation, custom rates, exemption, remaining shares, 1/3/5-month cycles | No effective date for price changes or stored allocation rule; UI infers fixed rates from saved values |
| Collections | Confirm receipt, payment method, dates/reference/note, advance next due, receipt history/CSV | Full-cycle only; no explicit installment, credit, refund or receipt reversal workflow |
| Forecast | Month selection and future scheduled rounds using current prices | Estimates, not posted receivables; missing configurations cannot be forecast |
| Supplier payment | Generate due monthly costs, explicit confirmation, unique source key | Historical due costs are regenerated using current package price |
| Cashbook | Manual income/expense; linked receipt/provider entries; edit/delete; filters | Hard deletion, no closing period, no separate recording vs actual payment date |
| Access | Auth, application/menu checks on pages, write permission checks in APIs | Read-only users can still see some editing controls; API denies writes |
| Activity | Actor, time, entity, action and summary; latest 500 | No before/after payload, search/export/pagination; logging failure does not roll back business operation |

## Prioritized findings

### P1 — Editing an opening entry changes group service start

`app/api/youtube/ledger/[id]/route.ts`, OPENING update branch, writes both openingReceivedSatang and startedOn from the ledger transaction date. A bookkeeping date correction can therefore change recurring supplier costs. Separate those dates and never change service start through an opening-entry edit.

### P1 — Reusing a seat loses the previous member assignment

Group updates overwrite memberId on an existing seat. Receipt deletion checks only seat.nextDueDate against payment.nextDueDate before rewinding that seat. An old receipt can therefore affect a new occupant if dates coincide. Introduce membership/assignment IDs and dates; prevent reversal from touching another assignment.

### P1 — Price and membership history are unavailable

The schema stores current group/seat prices and current seat occupants only. Rebuilding history after a price change or member swap cannot establish the actual former liability. Add effective-dated prices and assignments; generate persisted charge records with immutable snapshots. Preserve posted historical amounts.

### P2 — Linked receipt editing lacks optimistic concurrency

Ledger PUT reads the current row outside its transaction and updates without an expected version. Concurrent operators may overwrite each other. Require a version and return conflict on stale updates, covering linked payment and ledger atomically.

### P2 — Activity is incomplete as an audit trail

`lib/youtube-activity.ts` catches log failures after business commits. Logs store a summary only. Store successful mutation and before/after audit payload in the same transaction; preserve failed attempts separately when useful.

### P2 — Deletion is permanent

Group deletion removes its seats; member/payment/ledger deletion is also permanent in allowed paths. Historical payment snapshots remain after group deletion, but links are detached. Prefer archive for groups/members and reversal entries for posted money; offer restore where appropriate.

### P2 — Single-section editor still submits every seat

GroupForm sends all six accounts even when editing one account or group metadata. It also normalizes next dates using the group billing day. Add dedicated metadata, membership and pricing operations; show date changes before saving.

### P2 — Identity snapshots can become stale

Member contact/name updates do not update current seat.displayName, which many current screens use. Read current names through memberId; keep historical receipt names as immutable snapshots.

### P3 — Operational reporting gaps

Add paginated receipt/log queries, log search/date/entity filters and export, per-person totals across accounts, future collection export and alerts, and visible read-only controls. Full payment history currently loads into the collections client.

## Recommended implementation order

1. Fix opening-entry date coupling, assignment-safe reversal and stale-update protection.
2. Introduce persisted charges, assignment history and effective-dated prices with migration preserving all existing receipts.
3. Separate group metadata, membership and price editing endpoints/UI; preview all schedule changes.
4. Add transactional audit events, archive/restore and money reversal.
5. Add reports, pagination, reminders and stronger read-only UI.

The recorded cash balance is not accounting profit: prepaid multi-month receipts include future service periods. Future revenue recognition needs service-period reporting in addition to the cashbook.

## Implementation follow-through — 2026-10-21

The findings above describe the system at audit time. The following changes have now been applied:

- Opening-entry date edits no longer change group service start.
- Ledger edits/reversals require a version. Reversal retains the original and creates a linked negative entry in the same category and original accounting date; cancellation time is recorded separately. Member receipts are marked void, not deleted. Only the latest active receipt in the same assignment may rewind its schedule.
- Each occupation of a seat has an assignment key. Database uniqueness prevents two active receipts for the same assignment and due date.
- Group metadata, one-account editing and pricing use separate mutation scopes. A metadata save no longer rewrites accounts. Group metadata and member edits also protect against stale versions.
- Groups and members are archived instead of destroyed; a dedicated archive screen restores them. Active group membership prevents archiving a person. Restoring a group requires its people to be active.
- Business mutation APIs write actor activity inside their transaction. SQLite triggers capture before/after records atomically, including changes made outside those APIs.
- Dedicated membership periods and effective receipt-cycle price records retain future assignment/price changes. Existing data is a baseline: unknown original join dates are not invented.
- Monthly supplier charge snapshots preserve historical due amounts across later package/date changes. Initial snapshots use the configuration available at adoption time; earlier unknown prices cannot be reconstructed reliably.
- Activity/history supports search, type/date filters, paging and CSV. Receipt history is fetched in pages of 100, with full-filter totals and streaming CSV. Future collection estimates have CSV export.
- Read-only users see disabled write controls. Current member names follow directory updates; historical receipt names stay unchanged.
- Overview/collection due totals include all overdue rounds. Receipt confirmation still operates on one full round at a time.
- A service-period report separates received cash, estimated consumed service value and remaining prepaid service, including per-person/group totals. Allocation is daily over each recorded service interval; it is not profit recognition or an additional ledger posting.

Validation: TypeScript, focused ESLint and whitespace checks passed. Read-only reconciliation still shows 54 receipts totaling THB 4,408.02, expenses THB 3,990.00 and balance THB 418.02, with no missing/mismatched receipt-ledger pair. No end-to-end mutation tests were run. A pre-migration backup is retained outside the repository under `/Users/ohmz/Documents/obn-backups/youtube`.

Remaining product boundaries: receipts still represent a complete cycle; partial payment/credit/refund workflows and closing-period locks are not introduced by this change. In-app due queues exist; external messages and bank reconciliation are not connected.
