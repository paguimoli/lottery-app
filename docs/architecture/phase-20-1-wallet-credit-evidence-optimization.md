# Phase 20.1 - Wallet Reservation & Credit Evidence Path Optimization

## Objective

Phase 20.1 optimizes only the read-only evidence paths identified by the Phase 20.0 concurrency baseline. It does not change reservation writes, ticket purchase writes, settlement, ledger posting, credit calculations, authority routing, rollback behavior, or event contracts.

## Phase 20.0 Baseline

The Phase 20.0 baseline established these measured bottlenecks:

- Wallet reservation evidence reads at concurrency 250: P95 1107.926ms.
- Wallet reservation evidence reads at concurrency 500: P95 2132.426ms.
- Credit reserve/release cycle evidence reads at concurrency 250: P95 1114.648ms.

Highest measured throughput was 351.454/sec and slowest measured P95 was 2132.426ms.

## Selected Bottlenecks

The optimized scope is limited to:

- `WALLET_RESERVATIONS` evidence aggregation.
- `CREDIT_RESERVE_RELEASE_CYCLES` evidence aggregation.
- Load-testing evidence aggregation for those paths.

These are advisory reporting probes used by the load/concurrency baseline. Production financial write paths are not part of this phase.

## Methodology

The Phase 20.0 implementation issued one database read per concurrent evidence probe. Phase 20.1 keeps the public measurement contract intact while loading a bounded evidence snapshot once per wallet/credit scenario and reusing it during the concurrent in-memory aggregation phase.

The optimization keeps evidence visible by selecting the same columns used by the original probes and preserving `resultCount`, latency, throughput, CPU, memory, and queue fields in each scenario measurement.

## Optimizations Kept

- Bounded wallet reservation evidence snapshot for `credit_reservations`.
- Bounded credit reserve/release evidence snapshot for `credit_reservations`.
- In-run reuse of the loaded evidence snapshot for concurrent reporting probes.
- Direct before/after measurement through `ops:wallet-credit-evidence-optimization-report`.

## Optimizations Reverted

No attempted optimization was retained if it would require changing financial write logic, API response contracts, schema, indexes, routing, or historical evidence.

## Validation

Use:

```bash
npm run ops:wallet-credit-evidence-optimization-report
npm run qa:wallet-credit-evidence-optimization
```

The QA verifies protected operations APIs, unchanged response contracts, visible wallet/credit evidence, unchanged financial counts, unchanged authority/certification state, and measurable improvement for the optimized targets.

## Current Constraints

This phase does not add indexes. If later phases require database-level query optimization, index design should be reviewed separately with production impact analysis.

## Recommendation

Use Phase 20.1 as the optimized evidence-path baseline for Phase 20.2. Any future write-capable load harness must be approved separately because it would exercise financial mutation paths.
