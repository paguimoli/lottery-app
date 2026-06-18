# Phase 12.8 Financial Audit Completeness

## Purpose

Phase 12.8 hardens auditability for the financial lifecycle already implemented in the platform. It does not change wagering, settlement, credit, accounting, commission, cashier, or authentication behavior.

The objective is to make financial actions traceable by source records, audit records, outbox events, actor identity where available, and correlation IDs.

## Audit Coverage Matrix

| Lifecycle Event | Source Record | Audit Record | Outbox Event | Correlation ID | Actor ID | Replay Capability | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Deposits | `cashier_transactions`, `financial_ledger_entries` | cashier actor columns; auth audit when session action is recorded | `cashier.transaction.completed` when completion event integration exists | stored in event metadata/outbox where available | requested/approved user columns | reconstruct from cashier + ledger + outbox | Partial |
| Withdrawals | `cashier_transactions`, `financial_ledger_entries` | cashier actor columns | cashier events where emitted | stored in event metadata/outbox where available | requested/approved/rejected/cancelled user columns | reconstruct from cashier + ledger | Partial |
| Ticket placement | `tickets`, `credit_reservations` | ticket/reservation source rows | `credit.exposure.reserved` | `credit_reservations.correlation_id` | API/auth context outside ticket row | reconstruct ticket from ticket + reservation + outbox | Partial: no dedicated `ticket.accepted` outbox event |
| Ticket cancellation | `tickets`, `credit_reservations` | source rows | credit cancellation/release events where emitted | credit reservation correlation where available | API/auth context outside ticket row | reconstruct from ticket + reservation | Partial |
| Credit reservation | `credit_reservations` | source row | `credit.exposure.reserved`, `credit.reservation.rejected` | `credit_reservations.correlation_id` | not stored directly | reconstruct from reservation + outbox | Complete for source/outbox |
| Credit release | `credit_reservation_releases`, `credit_reservations` | source row | `credit.exposure.released` or settlement-applied event depending path | `credit_reservation_releases.correlation_id` | not stored directly | reconstruct from release + reservation + outbox | Complete for source/outbox |
| Settlement | `credit_settlement_applications`, settlement records when present | source row | `credit.settlement.applied`, `credit.balance.updated` | `credit_settlement_applications.correlation_id` | service/auth context outside settlement row | reconstruct from application + reservation + outbox | Complete for credit settlement path |
| Resettlement | resettlement records when present | resettlement audit domain records | settlement/outbox where emitted | varies by resettlement path | operator actor where available | reconstruct from resettlement + settlement rows | Partial |
| Accounting close | `weekly_accounting_snapshots`, ledger zero-balance entries when used | source row | `accounting.snapshot.generated`, `accounting.week.closed` | outbox `correlation_id`; ledger metadata for zero-balance | service/API actor outside snapshot row | reconstruct from snapshots + outbox + ledger | Complete for source/outbox |
| Commission run | `commission_runs`, `commission_run_details` | source row | `commission.run.completed` | `commission_runs.correlation_id` | service/API actor outside run row | reconstruct from run/details/snapshots/outbox | Complete for source/outbox |
| Commission adjustment | `commission_adjustments` | `actor_user_id` | `commission.adjustment.created` | `commission_adjustments.correlation_id` | `actor_user_id` | reconstruct from adjustment + outbox | Complete for source/outbox/actor |
| Reconciliation acknowledgement | `reconciliation_run_findings` review fields | `auth_audit_log` event | `reconciliation.finding.acknowledged` | API correlation/outbox | auth audit user id | reconstruct from finding + audit + outbox | Complete |
| Reconciliation resolution | `reconciliation_run_findings` review fields | `auth_audit_log` event | `reconciliation.finding.resolved` | API correlation/outbox | auth audit user id | reconstruct from finding + audit + outbox | Complete |
| Manual financial adjustments | `financial_ledger_entries` | ledger source row; auth audit where route records it | outbox when surrounding domain emits it | ledger metadata/idempotency where supplied | API actor outside ledger row | reconstruct from immutable ledger | Partial |
| Emergency operational actions | `break_glass_accounts`, `user_sessions`, `auth_audit_log` | `auth_audit_log` | operational outbox only when emitted by domain | request correlation where supplied | auth audit user id | reconstruct from audit/session/account state | Complete for Phase 12.6 controls |

## Financial Event Inventory

The read-only audit domain supports:

- correlation ID trail
- ticket trail
- reservation trail
- ledger transaction trail
- commission run trail
- accounting week trail

Each trail returns:

- source records
- auth audit events
- outbox events
- correlation IDs
- validation gaps
- reconstructability flag

## Validation Rules

For a supplied entity, the validator checks:

- source record exists
- outbox event exists
- correlation ID exists
- auth audit events exist when available

The validator reports but does not repair:

- missing source records
- missing outbox events
- missing correlation IDs
- missing auth audit events
- orphaned financial records
- orphaned settlement, commission, or accounting records

## Protected APIs

- `GET /api/audit/correlation/{correlationId}`
- `GET /api/audit/ticket/{ticketId}`
- `GET /api/audit/reservation/{reservationId}`
- `GET /api/audit/ledger/{transactionId}`
- `GET /api/audit/commission-run/{runId}`
- `GET /api/audit/accounting/week?weekStart=<ts>&weekEnd=<ts>&currency=<ISO>`

All endpoints require `audit.view`. No mutation APIs are added.

## Outbox Completeness Review

Coverage exists for:

- `credit.exposure.reserved`
- `credit.settlement.applied`
- `credit.balance.updated`
- `accounting.snapshot.generated`
- `accounting.week.closed`
- `commission.run.completed`
- `commission.adjustment.created`
- `reconciliation.run.reviewed`
- `reconciliation.finding.resolved`

Known gaps:

- No dedicated `ticket.accepted` event is emitted by the ticket placement RPC.
- Some cashier and manual ledger adjustment actions depend on surrounding route/domain events rather than ledger-native events.
- Actor ID is not stored directly on several financial source rows; it is available only through the calling route/session/audit context when recorded.

## Operational Scripts

Run an audit check:

```bash
npm run ops:audit -- --ticketId <id>
```

Supported inputs:

- `--correlationId`
- `--ticketId`
- `--reservationId`
- `--ledgerTransactionId`
- `--commissionRunId`
- `--weekStart` and `--weekEnd`

## QA

Run:

```bash
npm run qa:financial-audit-completeness
```

The QA harness uses existing QA-generated financial activity where available and verifies source records, outbox linkage, and correlation continuity.

## Limitations

This phase intentionally does not mutate historical records to backfill missing actor IDs or correlation IDs. Missing links are reported as audit gaps and should be remediated in future phases through append-only events or forward-only schema additions.
