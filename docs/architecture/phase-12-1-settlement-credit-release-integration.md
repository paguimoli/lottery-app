# Phase 12.1 Settlement Credit Release Integration

## Purpose

Phase 12.1 integrates settlement with the Phase 12.0 credit engine so settlement can progressively release ticket exposure and apply the resulting credit balance impact.

This phase intentionally changes runtime behavior through a new database-backed settlement application path. It does not move production logic into .NET services and does not route traffic to the Ledger Service or Credit Wallet Service.

## Settlement Flow Inventory

Current settlement components:

- `src/domains/settlement/settlement-executor.service.ts`
- `src/domains/settlement/settlement.controller.ts`
- `src/domains/settlement/settlement-ledger.service.ts`
- `src/domains/settlement/resettlement.service.ts`
- `src/domains/settlement/evaluators/*`

Current behavior:

1. Settlement runs evaluate accepted tickets by drawing and game.
2. Each pending ticket line becomes a `SettlementRecord`.
3. Each record includes `stake`, `payout`, `netAmount`, `outcome`, and status.
4. Ticket lines transition to `won`, `lost`, `push`, or `void`.
5. Tickets transition to `settled` once all lines are final.
6. Existing settlement ledger transactions are in-memory domain records, not the hardened financial ledger RPC.

Assumptions:

- `SettlementRecord.stake` is an integer minor-unit exposure amount.
- `SettlementRecord.netAmount` is the integer minor-unit credit balance impact.
- A credit ticket has `fundingType = "credit"` and `reservationId`.
- Settlement execution and resume controllers are async when credit settlement application is required.
- Currency must be supplied by the settlement caller for credit-backed settlement. Without currency, credit-backed settlement is marked failed rather than silently completed.

## Automatic Wiring Location

Automatic credit settlement wiring is in:

- `executeSettlementRunController(...)`
- `resumeSettlementRunController(...)`

The adapter is called after:

1. settlement records are produced
2. ticket and ticket line status updates are calculated
3. settlement ledger transaction ids are attached to settlement records

The controller then calls:

```text
applyCreditSettlementForRecords(...)
```

using the finalized settlement records and updated tickets.

Credit settlement is attempted only when at least one settlement record belongs to a ticket with `reservationId`.

Non-credit tickets and credit tickets without `reservationId` continue through the existing settlement path unchanged.

## Release Flow

New database object:

- `credit_settlement_applications`

New RPC:

- `apply_credit_settlement(...)`

The RPC:

1. Validates reservation id, ticket id, settlement id, release amount, balance impact, currency, and idempotency key.
2. Checks duplicate idempotency keys before mutating state.
3. Locks the credit reservation row.
4. Rejects inactive reservations.
5. Rejects ticket mismatch.
6. Rejects currency mismatch.
7. Rejects over-release.
8. Locks the player's CREDIT wallet.
9. Updates credit wallet balance by the settlement balance impact.
10. Records a `credit_settlement_applications` audit row.
11. Records a `credit_reservation_releases` audit row.
12. Updates reservation released, settled, and remaining exposure amounts.
13. Emits outbox events.

## Balance Update Flow

Credit balance impact comes from settlement:

- Winning settlement: positive `netAmount` increases player balance.
- Losing settlement: negative `netAmount` decreases player balance.
- Push or void settlement: zero `netAmount` leaves balance unchanged while still releasing exposure.

The SQL path updates the credit wallet inside the same transaction as the reservation release and settlement application audit row. TypeScript callers do not directly calculate or update wallet balances.

## Status Transitions

Supported settlement-driven transitions:

```text
RESERVED -> PARTIALLY_RELEASED -> SETTLED
```

Rules:

- `remainingExposure` must never become negative.
- `releasedAmount + remainingExposure` must reconcile against the reserved amount.
- `settledAmount` increases by the released settlement exposure.
- Full settlement sets reservation status to `SETTLED`.
- Partial settlement sets reservation status to `PARTIALLY_RELEASED`.

The existing general release RPC can still produce `RELEASED` for non-settlement release cases. Settlement application uses `SETTLED` for the final settlement release.

## Idempotency Behavior

Settlement application idempotency is enforced by:

- `credit_settlement_applications.idempotency_key`
- `credit_reservation_releases.idempotency_key`

Duplicate settlement application requests return the existing application and current reservation state. They do not:

- release exposure twice
- change balance twice
- emit duplicate outbox events

The TypeScript settlement adapter uses deterministic keys:

```text
credit-settlement:{settlementRecordId}
```

Settlement resume uses the same deterministic idempotency key, so replay or recovery does not release exposure twice or apply balance impact twice.

## Error Behavior

Credit settlement failures are not swallowed.

When credit settlement application fails, the settlement controller:

- logs a structured error
- includes `ticketId`
- includes `reservationId`
- includes `settlementRecordId`
- includes `settlementRunId`
- includes `correlationId`
- appends an execution error message
- marks the settlement run `failed`

This prevents a credit-backed settlement from appearing fully complete when exposure release or balance impact failed.

## Traceability

Every settlement credit application records:

- `ticketId`
- `reservationId`
- `settlementId`
- `correlationId`
- `releaseAmount`
- `balanceImpact`
- `operationType`
- metadata including settlement run, ticket line, outcome, and record status

This creates a trace from settlement record to reservation, wallet balance impact, release audit row, and outbox events.

## Outbox Events

Added events:

- `credit.settlement.applied`
- `credit.balance.updated`

`credit.settlement.applied` is emitted for every successful settlement application.

`credit.balance.updated` is emitted when `balanceImpact` is non-zero.

Events are recorded through the existing outbox table only. No direct RabbitMQ publishing was added.

## TypeScript Integration

Added credit service/repository method:

- `applyCreditSettlement(...)`

Added settlement adapter:

- `applyCreditSettlementForRecord(...)`
- `applyCreditSettlementForRecords(...)`

Wired settlement controllers:

- `executeSettlementRunController(...)`
- `resumeSettlementRunController(...)`

Added protected runtime endpoint:

- `POST /api/credit/settlements/apply`

The endpoint uses existing auth middleware and `tickets.settle` permission.

## Progressive Settlement Support

The RPC supports partial settlement by releasing only the supplied `releaseAmount`.

Example:

```text
Reserved exposure: 1000
Event A release: 400
Remaining exposure: 600
Status: PARTIALLY_RELEASED

Event B release: 600
Remaining exposure: 0
Status: SETTLED
```

This supports future multi-leg settlement without changing the reservation ownership model.

## Credit Summary Impact

`get_player_credit_summary(...)` already calculates:

```text
availableCredit = creditLimit + balance - pendingExposure
```

Settlement affects the formula by:

- decreasing `pendingExposure` through `remainingExposure`
- increasing or decreasing `balance` through `balanceImpact`

The summary updates after settlement without caching or Redis involvement.

## Limitations

- Existing persisted settlement execution routes are limited; this phase wires the domain controller path and exposes the credit settlement application path but does not redesign settlement orchestration.
- Settlement callers must pass currency for credit-backed settlement.
- Financial ledger service extraction is not used.
- Credit wallet service extraction is not used.
- Resettlement reversal integration is not implemented in this phase.
- Existing legacy `financial_wallets.balance` columns remain numeric; this phase writes integer minor-unit values through the SQL RPC.

## Future .NET Migration Notes

The future Credit Wallet Service should initially wrap the same database RPC rather than calculating balances independently.

The future Ledger Service should not take ownership of credit exposure reservations. It may consume emitted events for audit/read models once contracts and reconciliation are proven.

## Validation Checklist

- Apply `20260617000200_create_credit_settlement_integration.sql`.
- Verify `credit_settlement_applications` exists.
- Verify a reservation exists for a credit ticket.
- Apply a partial settlement and verify `remainingExposure` decreases.
- Apply final settlement and verify status becomes `SETTLED`.
- Attempt over-release and verify rejection.
- Repeat the same idempotency key and verify no duplicate release or balance change.
- Verify credit wallet balance changes by settlement `netAmount`.
- Verify credit summary reflects updated balance, pending exposure, and available credit.
- Verify outbox contains `credit.settlement.applied`.
- Verify outbox contains `credit.balance.updated` for non-zero balance impact.
