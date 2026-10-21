# YouTube invoicing and scheduled supplier payments

## User flow

- Open `/dashboard/youtube/invoices` to issue account invoices and group supplier payment requests.
- Member invoices have permanent sequential numbers (`YT-INV-000001`), immutable amount/cycle/name snapshots, due dates, service periods, printable detail pages, and issued/paid/cancelled states.
- One account is one invoice per cycle. Monthly, quarterly and five-month accounts retain independent due dates; the same person may have multiple invoices.
- Member invoice confirmation uses the existing payment transaction, creates the receipt and cashbook income, marks the invoice paid and advances the current assignment's schedule together. Payment against an old assignment's due invoice does not advance a new occupant's schedule.
- Cancel/reissue is allowed for unpaid invoices with a reason and version check. Paid invoice corrections go through cashbook reversal. Reversal reopens the linked invoice atomically.
- Supplier requests use the existing `YoutubePayable` approval workflow: pending approval → approved → explicitly confirmed paid. Opening or generating documents does not pay or transfer money.
- Existing paid supplier cycles and existing payable source keys are excluded from automatic issuing. Direct group payment is blocked while a matching active payable exists, preventing duplicate posting between the two workflows.

## Generation window

Opening the workspace or using its update button issues account documents through the end of next month, including at least the next account cycle even if it falls later, and supplier requests through the end of next month. Source keys are unique. Issued invoices retain their original price when configuration changes.

Generation currently occurs on page load or on demand. It is not an externally deployed daily scheduler. An operations command is provided for an existing host scheduler:

```sh
node --conditions=react-server scripts/generate-youtube-invoices.mjs
```

The local command uses Node 24's TypeScript support and module hooks to call the same application service. It creates documents only, never confirms cash. A scheduler must run it from the repository with its existing database environment. No bank transfer or external notification is connected.

## Adoption on 2026-10-21

- Pre-migration SQLite backup retained under `/Users/ohmz/Documents/obn-backups/youtube`.
- Initial issuance: 15 member invoices totaling THB 1,440.51 and three supplier requests totaling THB 1,197.00, awaiting approval.
- Existing cash totals remained income THB 4,408.02 and expense THB 3,990.00; generation did not change actual cash.
- TypeScript and focused lint checks passed. Browser delivery was blocked by an expired login session; receipt, approval and payment confirmations were not submitted during implementation.
