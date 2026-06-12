# Cashier Integration Architecture v1.0

## 1. Cashier Principles

Cashier integrations must be:

- provider independent
- auditable
- reconciliable
- idempotent
- permission controlled
- market configurable

No provider-specific logic should exist inside wallet, ledger, or settlement domains.

Cashier integrations must preserve domain separation:

- cashier provider logic handles provider communication
- wallet domain represents wallet state
- ledger domain records financial transactions
- audit domain records sensitive actions
- risk domain may hold or review activity

## 2. Cashier Adapter Architecture

Cashier Adapter Layer:

Purpose:

- Allow support for multiple providers through a common interface.
- Isolate provider-specific APIs, callbacks, authentication, and error formats.
- Prevent provider-specific rules from leaking into wallet, ledger, or settlement domains.

Examples:

- Provider A
- Provider B
- Provider C

All providers must implement common cashier actions:

- create deposit intent, where supported
- receive deposit callback
- submit withdrawal
- receive withdrawal callback or status update
- query transaction status
- normalize provider response
- expose reconciliation data where supported

## 3. Deposit Lifecycle

Flow:

Player Initiates Deposit
-> Provider Processes Payment
-> Provider Callback Received
-> Validate Callback
-> Create Deposit Record
-> Credit Cash Wallet
-> Create Ledger Entry
-> Create Audit Record

Rules:

- Only approved provider callback may credit funds.
- No manual balance credit outside authorized procedures.
- Deposit callbacks must be idempotent.
- Deposit records must be traceable to provider reference and platform account.
- Deposit credit must target the cash wallet.

## 4. Withdrawal Lifecycle

Flow:

Player Requests Withdrawal
-> Withdrawal Created
-> Approval Required
-> Provider Submission
-> Provider Response
-> Withdrawal Completed

Rules:

- All withdrawals require approval.
- Withdrawal request does not mean payment has been sent.
- Provider submission occurs only after approval.
- Withdrawal completion must be based on provider confirmation or authorized manual reconciliation.
- Failed withdrawals must enter operator review.

## 5. Withdrawal Approval Workflow

Support:

- Single approval model.

Flow:

Withdrawal Request
-> Authorized Operator Approval
-> Provider Submission

Approval authority:

- permission-based
- no role hardcoding
- thresholds may require higher permission or future dual control

Approval records must capture:

- requested amount
- account
- wallet
- market
- approving operator
- timestamp
- reason or notes

## 6. Failed Withdrawals

Examples:

- provider rejection
- timeout
- connectivity issue
- reconciliation mismatch

Rules:

- Create operator review task.
- No automatic balance restoration.
- Operator determines resolution.
- Resolution must be audited.
- Provider reference and failure reason must be preserved.

## 7. Callback Architecture

Requirements:

- callback validation
- signature verification where supported
- idempotency protection
- replay protection
- audit logging

Callbacks must never process twice.

Callback processing must verify:

- provider identity
- request signature or token
- provider transaction id
- platform transaction id, when available
- amount
- currency
- status
- account/wallet mapping
- callback timestamp

Duplicate callbacks must return a safe idempotent response without creating duplicate wallet credits, debits, ledger entries, or audit records.

## 8. Reconciliation Architecture

Support:

- Automatic reconciliation
- Manual reconciliation

Compare:

- provider records
- platform records
- wallet balances
- ledger entries

Generate reconciliation exceptions for:

- provider success with no platform transaction
- platform transaction with no provider confirmation
- amount mismatch
- currency mismatch
- status mismatch
- duplicate provider reference
- missing callback

Manual reconciliation must be permission-controlled and audited.

## 9. Cashier Reporting

Cashier reporting must support:

- deposits
- withdrawals
- pending withdrawals
- failed withdrawals
- reconciliation exceptions
- provider activity
- approval activity

Reports must be:

- permission scoped
- hierarchy scoped where account data is included
- market scoped
- exportable
- auditable

## 10. Cashier Permissions

Permission-based actions:

- approve withdrawal
- reverse deposit
- reverse withdrawal
- reconcile transaction
- view cashier reports
- view provider activity

No role hardcoding.

Permissions should support future high-risk thresholds, such as requiring elevated permission for large withdrawals or manual reconciliation.

## 11. Cashier Audit Requirements

Audit:

- deposit created
- deposit credited
- withdrawal requested
- withdrawal approved
- withdrawal submitted
- withdrawal completed
- withdrawal failed
- reconciliation action
- manual intervention

Audit records should include:

- actor
- account
- wallet
- amount
- currency
- market
- provider
- provider reference
- old value
- new value
- reason or notes
- timestamp

## 12. Risk Integration

Risk integration must support:

- withdrawal hold
- suspicious deposit review
- suspicious withdrawal review
- linked account review
- large transaction review

Risk flags may block withdrawals.

Risk review should be triggered by:

- large deposit
- large withdrawal
- repeated failed withdrawals
- linked account signal
- payment/provider mismatch
- account freeze
- suspicious velocity

Risk clearance must be permission-based and audited.

## 13. Multi-Provider Strategy

Future support:

- multiple providers per market
- provider priority
- provider failover
- provider routing

Examples:

Market A:

- Provider 1

Market B:

- Provider 2

Market C:

- Provider 1 + Provider 3

Routing criteria may include:

- market
- currency
- payment method
- provider availability
- transaction amount
- risk status

## 14. Market Configuration Integration

Cashier behavior may vary by market:

- enabled providers
- deposit limits
- withdrawal limits
- approval rules
- supported currencies

Market cashier configuration must determine:

- provider availability
- default provider
- fallback provider
- transaction limits
- approval thresholds
- reconciliation cadence

## 15. Future Cashier Tables

Conceptual tables only:

- cashier_providers
- cashier_transactions
- cashier_callbacks
- cashier_reconciliation_runs
- cashier_reconciliation_exceptions
- cashier_approval_records

No migrations are created in this phase.

Future tables should support:

- provider references
- idempotency keys
- callback payloads
- normalized statuses
- audit linkage
- reconciliation status

## 16. Failure Scenarios

Failure scenarios:

- provider offline
- callback failure
- duplicate callback
- reconciliation mismatch
- withdrawal rejection
- provider timeout

Required responses:

- alert generation
- audit creation
- operator review

Provider offline:

- disable provider routing if configured threshold is reached
- alert operators
- fail over if alternate provider exists

Callback failure:

- retry safely
- preserve raw callback where possible
- do not create duplicate financial entries

Duplicate callback:

- detect by idempotency key/provider reference
- return safe duplicate response
- do not post duplicate ledger transaction

Reconciliation mismatch:

- create reconciliation exception
- require operator review

Withdrawal rejection:

- mark withdrawal failed
- create operator review task
- do not automatically restore balance

Provider timeout:

- mark transaction pending provider confirmation
- alert if timeout exceeds market threshold

## 17. Open Questions

Future decisions:

- first cashier provider
- supported payment methods
- supported currencies
- withdrawal limits
- deposit limits
- callback authentication method
- provider redundancy strategy
- whether large withdrawals require dual control
- whether deposits require risk review above market threshold
- how long raw callback payloads are retained
