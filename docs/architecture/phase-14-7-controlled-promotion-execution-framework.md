# Phase 14.7 - Controlled Promotion Execution Framework

## Purpose

Phase 14.7 creates the execution framework required to safely evaluate a future Settlement authority promotion and rollback.

This phase performs simulation only.

It does not:

- set `SETTLEMENT_AUTHORITY=SERVICE`
- route live settlement authority to Settlement Service
- disable monolith settlement
- remove comparison mode
- remove rollback controls
- change financial calculations

## Promotion Execution Domain

The promotion execution domain centralizes:

- promotion simulation validation
- rollback simulation validation
- simulation audit event creation
- operator-facing simulation output

The first supported domain is `SETTLEMENT`.

## Promotion Simulation

`POST /api/authority/promotion/simulate`

Input:

```json
{
  "domain": "SETTLEMENT",
  "correlationId": "optional-correlation-id"
}
```

The simulation validates:

- promotion decision is `READY_FOR_CONTROLLED_PROMOTION`
- `DRY_RUN_APPROVAL` exists
- `PROMOTION_APPROVAL` exists
- rollback readiness is `READY`
- authority is `MONOLITH`
- comparison mode is `ENABLED`
- Settlement Service health is available

The simulation returns `promotionAllowed`, blockers, warnings, validation results, and an outbox audit event reference.

No authority state changes.

## Rollback Simulation

`POST /api/authority/rollback/simulate`

Input:

```json
{
  "domain": "SETTLEMENT",
  "correlationId": "optional-correlation-id"
}
```

The simulation validates:

- monolith path is available
- comparison mode is available
- authority controls are available
- rollback readiness is `READY`

The simulation returns `rollbackAllowed`, blockers, warnings, validation results, and an outbox audit event reference.

No authority state changes.

## Audit Events

Simulation emits append-only outbox events:

- `authority.promotion.simulated`
- `authority.rollback.simulated`

The events are persisted through the outbox pattern. There is no direct RabbitMQ publishing.

## Operations Commands

```bash
npm run ops:simulate-settlement-promotion
npm run ops:simulate-settlement-rollback
```

Both commands print:

- status
- allowed flag
- blockers
- warnings
- audit event reference

## Promotion Boundary

`promotionAllowed=true` means the platform is ready to plan a controlled promotion.

It does not mean authority has changed.

Only a future controlled promotion phase may change `SETTLEMENT_AUTHORITY`.

