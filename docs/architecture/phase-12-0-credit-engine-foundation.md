# Phase 12.0 Credit Engine Foundation

## Purpose

Phase 12.0 implements the first operational credit engine foundation inside the current Next.js/Supabase monolith for controlled North American credit-based beta testing.

This is not a .NET service extraction phase. The Credit Wallet Service remains a contract/skeleton target, while the monolith remains the execution path.

## Implemented Data Model

New table:

- `credit_reservations`

Core fields:

- `id`
- `player_id`
- `ticket_id`
- `amount`
- `currency`
- `status`
- `reserved_amount`
- `released_amount`
- `settled_amount`
- `remaining_exposure`
- `idempotency_key`
- `correlation_id`
- lifecycle timestamps
- `metadata`

Supported statuses:

- `RESERVED`
- `PARTIALLY_RELEASED`
- `RELEASED`
- `SETTLED`
- `CANCELLED`
- `FAILED`

New release audit table:

- `credit_reservation_releases`

This table provides idempotency and auditability for partial/full exposure releases.

Money fields use integer minor currency units through `bigint`. No floating point or decimal money columns were added for reservation amounts.

## Reservation Lifecycle

Reservation creation is performed by:

- `reserve_credit_exposure(...)`

The RPC:

1. Validates amount, currency, ticket id, and idempotency key.
2. Resolves the player to a current account id.
3. Locks the player's credit wallet row.
4. Calculates pending exposure from active reservations.
5. Calculates available credit.
6. Rejects insufficient credit.
7. Inserts a reservation.
8. Records an outbox event.

Active exposure statuses:

- `RESERVED`
- `PARTIALLY_RELEASED`

## Available Credit Formula

Locked formula:

```text
availableCredit = creditLimit + balance - pendingExposure
```

Interpretation:

- `balance > 0`: player is winning.
- `balance < 0`: player owes money.
- `pendingExposure`: sum of `remaining_exposure` for active reservations.

Current assumption:

Existing `financial_wallets.balance` and `financial_wallets.credit_limit` are cast to integer minor units for this foundation. A later monetary normalization phase should fully align legacy wallet columns with Platform Standard #001.

## Ticket Gating Behavior

The existing ticket intake RPC is replaced with a gated implementation:

- `place_ticket_with_wallet_debit(...)`

Despite the legacy name, the Phase 12.0 behavior gates ticket acceptance through credit reservation.

Behavior:

1. Reject non-positive ticket amount.
2. Reject invalid currency.
3. Return existing ticket for duplicate external ticket id.
4. Create credit reservation before ticket insert.
5. Insert ticket with `credit_reservation_id`.
6. Insert ticket legs where the legacy table exists.
7. Return reservation id in the response.

If reservation fails, the ticket is not accepted. If ticket insert fails, the database transaction rolls back the reservation.

## Idempotency Behavior

Reservation idempotency:

- `credit_reservations.idempotency_key` is unique.
- Duplicate reserve requests with the same idempotency key return the existing reservation.

Release idempotency:

- `credit_reservation_releases.idempotency_key` is unique.
- Duplicate release requests with the same idempotency key return the current reservation state without releasing twice.

Ticket intake idempotency:

- Existing ticket lookup by organization and external ticket id remains.
- The intake route passes `Idempotency-Key` to the RPC when supplied.
- If no header is supplied, the RPC uses a deterministic ticket idempotency key.

## Release Behavior

Release is performed by:

- `release_credit_exposure(...)`

The RPC:

1. Validates release amount and idempotency key.
2. Locks the reservation row.
3. Rejects inactive reservations.
4. Rejects ticket mismatch.
5. Rejects over-release.
6. Records a release audit row.
7. Updates released amount and remaining exposure.
8. Sets status to `PARTIALLY_RELEASED` or `RELEASED`.
9. Records an outbox event.

## Outbox Events

Phase 12.0 records events through the existing outbox pattern:

- `credit.exposure.reserved`
- `credit.exposure.released`
- `credit.reservation.rejected`

RabbitMQ remains transport only. No direct RabbitMQ publish was added.

## Internal Interfaces

Added monolith domain module:

- `src/domains/credit/credit-reservation.*`

Exposed protected API routes:

- `POST /api/credit/reservations`
- `POST /api/credit/reservations/{reservationId}/release`
- `GET /api/credit/players/{playerId}/summary`

These routes use existing auth middleware and permissions:

- `tickets.create`
- `tickets.settle`
- `accounts.view`

## Known Limitations

- Settlement is not fully integrated with release yet.
- Weekly accounting does not yet consume credit reservations.
- Commission calculation does not yet consume credit exposure or final credit statements.
- Credit allocation hierarchy rules remain planned.
- The future Credit Wallet Service does not own execution yet.
- Existing wallet balance/credit limit columns are numeric legacy columns; reservation amounts are integer minor units.
- Legacy ticket table availability and shape are deployment-dependent; the RPC preserves the existing route assumptions.

## Manual Validation

Recommended checks after applying migration:

1. Create or identify a player account with an active CREDIT wallet and sufficient credit limit.
2. Place a credit ticket through `POST /api/tickets` using integer minor-unit leg amounts.
3. Verify `credit_reservations` contains one `RESERVED` row.
4. Verify the accepted ticket references `credit_reservation_id`.
5. Verify `get_player_credit_summary(...)` reports increased `pendingExposure`.
6. Repeat the request with the same idempotency key and verify no duplicate reservation.
7. Lower available credit or submit a large ticket and verify rejection.
8. Release part of the reservation and verify `PARTIALLY_RELEASED`.
9. Attempt over-release and verify rejection.
10. Release the remaining exposure and verify `RELEASED`.

## Next Phase Recommendations

1. Integrate settlement execution with progressive credit release.
2. Add credit-aware weekly accounting summary calculations.
3. Add credit reconciliation reports.
4. Add beta operator exposure reports.
5. Add automated tests against a migrated test database.
6. Normalize all money columns to integer minor units in a planned compatibility phase.
