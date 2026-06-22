# Phase 15.1 - Settlement Post-Promotion Monitoring and Rollback Drill

## Purpose

Phase 15.1 validates that Settlement remains service-authoritative after the
controlled Phase 15.0 promotion and that rollback can be drilled safely without
changing authority.

This phase does not promote Ledger or Credit, does not disable comparison mode,
does not remove the monolith settlement path, and does not alter settlement,
ledger, credit, accounting, commission, or reconciliation calculations.

## Current Authority Model

| Domain | Authority | Comparison |
| --- | --- | --- |
| Settlement | `SERVICE` | `ENABLED` |
| Ledger | `MONOLITH` | `ENABLED` |
| Credit | `MONOLITH` | `ENABLED` |

## Monitoring Model

The post-promotion status combines:

- Settlement authority status.
- Settlement comparison mode.
- Promotion timestamp.
- Latest settlement shadow comparison.
- Settlement mismatch count since promotion.
- Settlement failure count since promotion.
- Rollback readiness.
- Rollback trigger state.
- Settlement Service health.

The monitoring API is:

`GET /api/authority/settlement-post-promotion-status`

The operations command is:

```bash
npm run ops:settlement-post-promotion-status
```

## Rollback Drill

The rollback drill is simulation-only. It validates:

- Monolith path available.
- Settlement Service path available.
- Authority controls available.
- Comparison mode enabled.
- Rollback readiness `READY`.
- Rollback drill event can be emitted.
- No authority change occurs.

The drill API is:

`POST /api/authority/rollback/drill`

Payload:

```json
{
  "domain": "SETTLEMENT",
  "mode": "SIMULATION"
}
```

The operations command is:

```bash
npm run ops:simulate-settlement-rollback-drill
```

## Recommendations

Monitoring recommendations are advisory:

- `CONTINUE_MONITORING`: controls and post-promotion evidence are clean.
- `REVIEW_REQUIRED`: mismatches, failures, rollback-trigger conditions, or
  rollback readiness need operator review.
- `ROLLBACK_RECOMMENDED`: Settlement Service health is unavailable while
  Settlement is service-authoritative.
- `BLOCKED`: Settlement is not in the expected post-promotion authority state.

## Rollback Execution Procedure

Phase 15.1 does not execute rollback by default. Future controlled rollback must:

1. Confirm a rollback approval or documented emergency recovery authority.
2. Confirm monolith path is available.
3. Confirm comparison mode can remain enabled.
4. Set `SETTLEMENT_AUTHORITY=MONOLITH`.
5. Emit append-only `authority.rollback.executed`.
6. Run reconciliation and post-rollback QA.
7. Preserve promotion, rollback, and shadow evidence.

## Conditions Requiring Rollback Review

Operators must review rollback if:

- Settlement Service health is unavailable.
- Rollback readiness is `BLOCKED`.
- Post-promotion critical mismatches appear.
- Post-promotion failures appear.
- Comparison mode is disabled.
- Ledger or Credit authority unexpectedly changes.

## Validation Checklist

- Settlement authority remains `SERVICE`.
- Ledger authority remains `MONOLITH`.
- Credit authority remains `MONOLITH`.
- Settlement comparison mode remains `ENABLED`.
- Rollback drill passes.
- Rollback drill does not change authority.
- Post-promotion status endpoint reports health and evidence.
- Credit launch QA still passes.
- Worker observability QA still passes.
