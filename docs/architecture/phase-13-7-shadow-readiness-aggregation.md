# Phase 13.7 - Shadow Readiness Aggregation

## Purpose

Phase 13.7 adds a unified operational readiness layer for future service extraction decisions. It aggregates shadow evidence from Settlement, Ledger, and Credit Wallet shadow reporting into one advisory platform view.

This phase is informational only. It does not transfer authority, reroute production traffic, or change financial behavior.

## Inputs

The readiness service reads:

- `settlement_shadow_runs`
- `settlement_shadow_mismatches`
- `settlement_shadow_failures`
- `ledger_shadow_runs`
- `ledger_shadow_mismatches`
- `ledger_shadow_failures`
- `credit_shadow_runs`
- `credit_shadow_mismatches`
- `credit_shadow_failures`

If any domain's shadow tables are missing or unavailable, that domain is marked `BLOCKED` with `SHADOW_DATA_UNAVAILABLE`.

## Time Windows

Supported windows:

- `24h`
- `7d`
- `30d`
- `all`

The default window is `7d`.

## Per-Domain Metrics

Each domain reports:

- `totalRuns`
- `matches`
- `mismatches`
- `failures`
- `matchRate`
- `mismatchRate`
- `failureRate`
- `criticalMismatchCount`
- `readinessStatus`

Rates are decimals from `0` to `1`.

## Readiness Status

Domain statuses:

- `READY`
- `WARNING`
- `BLOCKED`

Default thresholds:

- READY when mismatch rate `< 0.1%`, failure rate `< 0.1%`, and no critical mismatches exist.
- WARNING when mismatch or failure rate is at or above `0.1%`.
- BLOCKED when mismatch rate is at or above `1%`, any critical mismatch exists, or shadow data is unavailable.

Domain-specific threshold environment variables are reused:

- `SETTLEMENT_SHADOW_READY_MISMATCH_RATE`
- `SETTLEMENT_SHADOW_READY_FAILURE_RATE`
- `SETTLEMENT_SHADOW_BLOCKED_MISMATCH_RATE`
- `LEDGER_SHADOW_READY_MISMATCH_RATE`
- `LEDGER_SHADOW_READY_FAILURE_RATE`
- `LEDGER_SHADOW_BLOCKED_MISMATCH_RATE`
- `CREDIT_SHADOW_READY_MISMATCH_RATE`
- `CREDIT_SHADOW_READY_FAILURE_RATE`
- `CREDIT_SHADOW_BLOCKED_MISMATCH_RATE`

## Platform Status

Platform extraction readiness:

- `READY`: Settlement, Ledger, and Credit are all READY.
- `WARNING`: at least one domain is WARNING and none are BLOCKED.
- `BLOCKED`: any domain is BLOCKED.

## Recommendation Engine

Recommendations are advisory only:

- `SETTLEMENT_READY`: Settlement domain is READY.
- `LEDGER_READY`: Ledger domain is READY.
- `CREDIT_READY`: Credit domain is READY.
- `ALL_READY`: all three domains are READY.
- `CONTINUE_SHADOWING`: extraction should not proceed yet.
- `BLOCKED_BY_CRITICAL_MISMATCHES`: one or more critical mismatches exist.
- `BLOCKED_BY_FAILURE_RATE`: one or more domains exceed failure-rate readiness thresholds.
- `SHADOW_DATA_UNAVAILABLE`: one or more domains cannot load shadow evidence.

Primary recommendation priority:

1. `SHADOW_DATA_UNAVAILABLE`
2. `BLOCKED_BY_CRITICAL_MISMATCHES`
3. `BLOCKED_BY_FAILURE_RATE`
4. `ALL_READY`
5. `CONTINUE_SHADOWING`

## API

`GET /api/shadow-readiness?window=7d`

Protected by existing `system.admin` permission.

Returns:

- per-domain readiness
- platform readiness
- recommendation list
- primary extraction recommendation

## Operations Command

```bash
npm run ops:shadow-readiness -- --window=7d
```

Requires `OPERATIONS_SESSION_TOKEN` or `QA_ADMIN_SESSION_TOKEN`.

## Extraction Decision Criteria

Authority transfer should not begin unless:

- all domains report READY for the selected operational window
- no critical mismatches exist
- failure rates remain below thresholds
- reconciliation remains clean
- rollback procedures are current
- shadow migrations are applied and stable
- operators review sustained results, not a single run

## Non-Goals

This phase does not:

- cut over Settlement
- cut over Ledger
- cut over Credit
- change production routing
- change financial, settlement, ledger, credit, accounting, or commission math
- create UI
