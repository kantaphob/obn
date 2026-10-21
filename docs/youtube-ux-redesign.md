# YouTube workspace: UX redesign

## Scope and observations

Reviewed the live groups page, current component structure, billing rules, and a read-only data inventory on 20 October 2026 (Bangkok).

- 3 groups, 17 occupied account slots; 14 monthly and 3 quarterly slots; 1 exempt slot.
- 1 group has no service start date. This needs a setup prompt, rather than a zero that looks like a calculated bill.
- Existing receipts and opening balances are different sources. An opening balance must never appear as newly received money.
- Configuration, collections, supplier charges, and history were repeated on the overview and groups pages.
- The group modal presents all six long account forms, calculation controls, historical totals and dates at once.
- Text frequently uses 9–11px sizes; the most frequent action competes with secondary calculations.

## Priority issues and decisions

| Severity | Problem | Change |
| --- | --- | --- |
| Critical | Monthly cost, member charges for different intervals and real cash look interchangeable | Explicitly label package cost/month, member fee/month, collection amount/round, and confirmed receipts/expenses |
| Critical | Picking another member redistributes previously entered prices | Keep saved/custom amounts; offer an explicit reallocation action |
| High | Receiving money is mixed with setting up a group | Dedicated member collections page and a separate cashbook for supplier payments |
| High | Single modal requires scrolling through repeated long forms | Three stages: group details, compact account allocation, review |
| High | Historical/group totals obscure the next action | Overview prioritizes due member collections and unconfirmed supplier payments |
| Moderate | A person with multiple slots looks like duplicate data | Show account position and group per row, and aggregate fees by stable member ID in review |
| Moderate | Zero and missing configuration are hard to distinguish | Named exemption mode and explicit missing-setup state |
| Moderate | Tiny labels, dense explanatory text | Readable typography, consistent controls, advanced settings revealed on request |

## Navigation

| Page | Primary task |
| --- | --- |
| Overview | Decide what needs attention today |
| Groups and accounts | Set package cost, billing day, start date, and six account slots |
| Collect from members | Find due accounts, confirm received money, review receipt history |
| Members | Maintain reusable identities and contact details |
| Cashbook | Confirm recurring supplier payments and inspect actual income/expenses |
| Activity log | Inspect changes when needed |

## Group editing flow

1. **Group details:** name, monthly package cost, recurring supplier payment day, service start date. Opening receipts belong in an optional historical-data section.
2. **Accounts and prices:** compact rows for owner + five secondary accounts. Each has a person/account, payment interval, monthly fee, and collection amount. Pricing modes: automatic remainder, custom price, exemption. Dates and special rules appear under account settings.
3. **Review:** compare monthly package cost against total monthly member fees; explain rounding difference; list each person's account count and monthly total; explicitly save.

Saved fees and dates remain intact until the user changes them. Changing group metadata alone must not silently rewrite existing per-round amounts. Selecting a person more than once remains supported, with distinct account slots and independent schedules.

## Financial terminology and invariants

- **Package cost/month:** the supplier expense for a group, e.g. 399 baht.
- **Member fee/month:** calculated per participating account, rounded up to whole baht, or explicitly customized.
- **Collection amount/round:** member monthly fee × selected months. Different intervals are never added together and presented as one monthly bill.
- **Due collection:** an unpaid member round whose due date has arrived.
- **Supplier payment awaiting confirmation:** derived from the group's start date and billing day; it becomes an expense only after explicit confirmation.
- **Confirmed cash:** taken from actual ledger entries. Opening amounts are displayed separately.
- No membership, financial records, start dates, or receipt confirmations are modified as part of this redesign.

## Verification

Run TypeScript and focused lint checks, existing isolated billing/cashbook regression checks, and read-only browser checks of navigation, group wizard and confirmation dialogs. Do not submit real financial records during UI verification.

### Completed checks

- TypeScript compilation, focused YouTube ESLint, and diff whitespace checks passed.
- Existing isolated billing/cashbook regression checks passed during implementation.
- Read-only browser review confirmed overview queues, group editing stages, collection rows, and the cashbook payment deep link.
- No real receipt, supplier payment, or group change was submitted during browser review.
