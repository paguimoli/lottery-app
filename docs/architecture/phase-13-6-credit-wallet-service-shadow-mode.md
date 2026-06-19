# Phase 13.6 - Credit Wallet Service Shadow Mode

## Purpose

Phase 13.6 creates a Credit Wallet Service shadow-mode foundation. The monolith remains authoritative for credit reservations, releases, settlement-credit application, balances, pending exposure, and available credit.

Credit Wallet Service can independently validate credit arithmetic and persist shadow evidence for future extraction decisions.

## Authority Boundary

Credit Wallet Service shadow mode must not:

- update production balances
- modify production reservations
- change available credit
- change pending exposure
- emit production financial outbox events
- become the credit system of record

The only allowed persistence is shadow evidence in `credit_shadow_runs`, `credit_shadow_mismatches`, and `credit_shadow_failures`.

## Shadow Endpoints

- `POST /v1/credit/shadow/reserve`
- `POST /v1/credit/shadow/release`
- `POST /v1/credit/shadow/settlement`

Input includes:

- `correlationId`
- `accountId`
- `walletId`
- `ticketId`
- `reservationId`
- `amountMinor`
- `currency`
- `availableCreditBefore`
- `pendingExposureBefore`
- `remainingExposureBefore`
- `releasedAmountBefore`
- `balanceImpactMinor`
- `expectedMonolithResult`

Output includes:

- `success`
- `shadowCreditRunId`
- `calculatedResult`
- `comparisonStatus`
- `mismatches`
- `correlationId`

Money uses integer minor units only.

## Shadow Calculations

Reserve:

```text
availableCreditAfter = availableCreditBefore - amountMinor
reservedAmount = amountMinor
```

Release:

```text
releasedAmount = releasedAmountBefore + amountMinor
remainingExposure = remainingExposureBefore - amountMinor
availableCreditAfter = availableCreditBefore + amountMinor
```

Settlement:

```text
releasedAmount = releasedAmountBefore + amountMinor
remainingExposure = remainingExposureBefore - amountMinor
availableCreditAfter = availableCreditBefore + amountMinor + balanceImpactMinor
```

The service rejects over-release when `amountMinor > remainingExposureBefore`.

## Monolith Integration

When `CREDIT_SHADOW_MODE_ENABLED=true`, the monolith calls the shadow service after successful authoritative operations:

- `reserveCreditExposure`
- `releaseCreditExposure`
- `applyCreditSettlement`

Shadow failures are logged and must never fail production credit processing.

## Mismatch Categories

- `AVAILABLE_CREDIT_MISMATCH`
- `RESERVATION_AMOUNT_MISMATCH`
- `EXPOSURE_MISMATCH`
- `SETTLEMENT_CREDIT_MISMATCH`
- `CURRENCY_MISMATCH`
- `UNKNOWN_MISMATCH`

Severity:

- `CRITICAL`: available credit, reservation amount, exposure, settlement credit, or currency mismatch.
- `WARNING`: unknown mismatch.
- `INFO`: reserved for future non-blocking differences.

## Reporting

Protected APIs:

- `GET /api/credit-shadow/summary`
- `GET /api/credit-shadow/mismatches`
- `GET /api/credit-shadow/failures`

Authorization requires `system.admin`, which includes Super Admin and Operations Admin through the existing permission model.

## Readiness Metrics

The summary endpoint reports:

- `MATCH_RATE`
- `MISMATCH_RATE`
- `FAILURE_RATE`

Default thresholds:

- READY: mismatch rate `< 0.1%` and failure rate `< 0.1%`, with no critical mismatches.
- WARNING: mismatch rate or failure rate at or above `0.1%`.
- BLOCKED: mismatch rate at or above `1%`, or any critical mismatch is present.

Thresholds are configurable with:

- `CREDIT_SHADOW_READY_MISMATCH_RATE`
- `CREDIT_SHADOW_READY_FAILURE_RATE`
- `CREDIT_SHADOW_BLOCKED_MISMATCH_RATE`

## QA

- `npm run qa:credit-shadow`
- `npm run qa:credit-shadow-reporting`

`qa:credit-shadow-reporting` requires the credit shadow migration to be applied and `QA_ADMIN_SESSION_TOKEN` to be set.

## Limitations

- Credit Wallet Service does not read production credit state.
- Shadow mode validates submitted arithmetic rather than replaying all historical reservations.
- Monolith integration does not include a guaranteed available-credit-before value for every operation yet.
- Shadow mode is evidence gathering only and cannot be used as authority.

## Future Extraction Notes

Future authority transfer requires sustained READY shadow metrics, reconciliation evidence, rollback procedures, feature-flagged routing, operational dashboards, and proof that Credit Wallet Service can safely wrap or replace the current monolith credit RPCs.
