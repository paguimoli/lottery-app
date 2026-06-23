# Phase 16.5 - Ledger Post-Promotion Monitoring and Rollback Drill

## Purpose

Phase 16.5 adds operational monitoring and rollback-drill support for the Ledger Service after controlled promotion. Ledger remains `SERVICE` authoritative with comparison mode enabled. This phase does not execute rollback, change routing, change ledger posting behavior, or alter financial calculations.

## Current Authority Model

- Settlement: `SERVICE`, certified.
- Ledger: `SERVICE`, comparison `ENABLED`.
- Credit: `MONOLITH`.

Ledger Service is the authoritative candidate under observation. The monolith ledger path remains available for comparison and rollback safety.

## Monitoring Workflow

`GET /api/authority/ledger-post-promotion-status` returns:

- authority state
- comparison mode
- promotion timestamp
- Ledger Service health
- rollback readiness
- lifecycle-effective rollback trigger
- raw evidence summary
- promotion evidence summary
- post-promotion evidence summary
- latest ledger shadow comparison
- post-promotion mismatch and failure counts
- operator recommendation

The endpoint is protected by existing admin authorization. It is read-only and does not mutate authority state.

## Rollback Drill Workflow

`POST /api/authority/ledger-rollback/drill` supports simulation only:

```json
{
  "mode": "SIMULATION",
  "correlationId": "optional"
}
```

The drill validates:

- Ledger authority is currently `SERVICE`.
- Ledger comparison mode is `ENABLED`.
- Ledger monolith path is available.
- Ledger Service path is healthy.
- rollback readiness is `READY`.
- authority controls are available.

The drill emits the append-only outbox event `authority.ledger.rollback.drill.simulated`.

## Expected Outputs

A passing drill returns:

- `drillPassed: true`
- `authorityBefore: SERVICE`
- `authorityAfter: SERVICE`
- `authorityChanged: false`

No rollback is executed. No routing changes occur.

## Operator Review Process

Operators should run:

```bash
npm run ops:ledger-post-promotion-status
npm run ops:simulate-ledger-rollback-drill
```

Review is required if:

- Ledger Service health is unavailable.
- rollback readiness is not `READY`.
- post-promotion lifecycle-effective mismatches or failures appear.
- the drill reports authority mutation.

## Audit Events

Rollback drill simulation records:

- event type: `authority.ledger.rollback.drill.simulated`
- aggregate type: `authority_candidate`
- aggregate id: `LEDGER`
- correlation id when supplied

The event is emitted through the existing outbox pattern only.

## Non-Goals

- No actual rollback.
- No authority change.
- No ledger posting behavior change.
- No balance calculation change.
- No settlement or credit behavior change.
