# Phase 20.4 - Settlement Evidence Aggregation Optimization

## Objective

Phase 20.4 optimizes the settlement evidence aggregation bottleneck identified after Phase 20.3. The phase is limited to read-only reporting and load-testing evidence aggregation.

No settlement execution, settlement writes, ledger posting, wallet reservation, ticket purchase, credit calculation, authority routing, rollback behavior, event contract, or public API contract changes are included.

## Bottleneck Selected

The latest post-Phase 20.3 baseline identified:

- Scenario: `SETTLEMENT_PROCESSING`
- Concurrency: `100`
- Step: `SETTLEMENT_EVIDENCE`
- Observed P95: `791.136ms`

The likely source was repeated settlement application evidence reads during a single load-testing run.

## Methodology

The original load-testing harness executed one settlement evidence query per concurrent probe. Phase 20.4 keeps the same public load-testing response contract but loads a bounded settlement application evidence snapshot once per settlement-processing scenario and reuses that evidence in memory for the concurrent aggregation phase.

The optimization preserves:

- Settlement evidence visibility.
- Scenario latency, throughput, CPU, memory, result count, and step measurements.
- Existing protected operations APIs.
- Financial counts and authority state.

## Optimizations Kept

- Bounded settlement application evidence snapshot for the `SETTLEMENT_PROCESSING` scenario.
- In-run reuse of settlement evidence for concurrent reporting probes.
- Before/after measurement through `ops:settlement-evidence-optimization-report`.

## Reverted Attempts

No optimization was kept that required write-path changes, schema/index changes, public API response changes, financial behavior changes, or historical evidence mutation.

## Behavior Guarantees

This phase is measurement and reporting only. It does not create tickets, reserve wallets, settle tickets, post ledger entries, mutate credit state, publish events, change authority, or alter rollback readiness.

## Validation

Use:

```bash
npm run ops:settlement-evidence-optimization-report
npm run qa:settlement-evidence-optimization
```

The QA verifies protected APIs, unchanged response contracts, visible settlement evidence, unchanged financial counts, unchanged authority/certification state, and measurable improvement for the settlement evidence target.

## Remaining Bottlenecks

After settlement evidence optimization, remaining bottlenecks should be identified by the concurrency bottleneck report before any additional optimization is attempted.

## Recommendation

Use Phase 20.5 to re-run bottleneck identification and target only the next confirmed read-only evidence path.
