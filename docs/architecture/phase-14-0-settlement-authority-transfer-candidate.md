# Phase 14.0 - Settlement Authority Transfer Candidate

## Purpose

Phase 14.0 adds the infrastructure required to evaluate a future Settlement Service authority transfer while keeping the monolith authoritative.

No cutover is performed in this phase.

## Authority Decision Engine

The settlement authority decision engine combines:

- authority configuration
- comparison mode
- settlement shadow metrics
- rollback readiness
- mismatch thresholds
- rollback trigger thresholds

The decision engine is advisory. It does not change settlement execution.

## Runtime Routing Abstraction

The runtime route abstraction resolves:

- authoritative path
- comparison path
- dry-run mode
- production cutover status

Current required state:

```text
authoritativePath=MONOLITH
comparisonPath=SETTLEMENT_SERVICE
productionCutoverActive=false
```

Future settlement cutover code must use this abstraction rather than reading environment variables directly.

## Dry-Run Mode

`SETTLEMENT_AUTHORITY_DRY_RUN_MODE=ENABLED` allows operators to evaluate authority routing decisions without changing the authoritative execution path.

Dry-run mode does not post ledger entries, release credit, mutate settlement state through the service, or publish financial outbox events.

## Rollback Trigger Evaluation

Rollback trigger evaluation checks:

- critical mismatches
- settlement mismatch rate
- settlement shadow failure rate
- rollback readiness

Automatic rollback is advisory only while authority remains `MONOLITH`.

## Thresholds

```text
SETTLEMENT_MISMATCH_ALERT_THRESHOLD=0.001
SETTLEMENT_ROLLBACK_FAILURE_THRESHOLD=0.001
```

Mismatch threshold enforcement blocks readiness if the threshold is exceeded or critical mismatches are present.

## Audit Logging

Settlement authority control events are emitted through structured logs:

- `SETTLEMENT_AUTHORITY_READINESS_EVALUATED`
- `SETTLEMENT_AUTHORITY_ROUTE_RESOLVED`
- `SETTLEMENT_AUTHORITY_ROLLBACK_TRIGGER_EVALUATED`

## API

```text
GET /api/authority/settlement-readiness
```

Protected by `system.admin`.

## Non-Goals

- No authority transfer.
- No production routing change.
- No financial ownership change.
- No auth change.
- No automatic mutation of settlement, ledger, or credit state.
