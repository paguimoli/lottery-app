# Phase 20.5 - Performance Validation and Optimization Gate

## Objective

Phase 20.5 re-runs the complete performance and concurrency baseline after Phases 19.x through 20.4. It is a validation gate only.

No business logic, authority routing, financial calculations, writes, event contracts, schema, indexes, rollback behavior, or comparison mode changed in this phase.

## Inputs

The final baseline aggregates:

- `GET /api/operations/performance-baseline`
- `GET /api/operations/concurrency-baseline`
- `ops:concurrency-bottleneck-report`
- `ops:query-optimization-report`

The report is produced by:

```bash
npm run ops:final-performance-baseline
```

The idempotent gate QA is:

```bash
npm run qa:performance-validation
```

## Classification Rules

Each ranked latency item is classified as:

- `CRITICAL`: financial path with P95 above `1000ms` or errors
- `HIGH`: repeated P95 above `1000ms`
- `MEDIUM`: P95 from `500ms` through `1000ms`
- `LOW`: P95 from `250ms` through `500ms`
- `IGNORE`: below `250ms` or non-material

`LOW` and `IGNORE` items are not optimization candidates. `MEDIUM` items are retained as baseline unless repeated measurements justify a future targeted phase. `CRITICAL` and `HIGH` items block the gate.

## Current Baseline Methodology

The report records:

- Platform authority and certification state.
- Comparison and rollback readiness.
- Performance baseline HTTP and database latency.
- Concurrency scenario and step-level latency.
- Top 20 latency ranking.
- Throughput summary.
- Query optimization status.
- Remaining bottleneck classification.

All reads are measurement-only.

## Exit Criteria

The gate passes when:

- Settlement remains `SERVICE / CERTIFIED`.
- Ledger remains `SERVICE / CERTIFIED`.
- Credit remains `SERVICE / CERTIFIED`.
- Comparison remains `ENABLED`.
- Rollback remains `READY`.
- No `CRITICAL` or `HIGH` bottleneck remains.
- `qa:performance-validation`, `qa:performance-baseline`, `qa:concurrency-baseline`, and `qa:all` pass.

## Recommendation

If no `CRITICAL` or `HIGH` bottleneck remains, performance engineering is complete and the platform can proceed to Phase 21 Resilience Engineering.
