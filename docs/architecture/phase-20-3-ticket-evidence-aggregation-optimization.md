# Phase 20.3 - Ticket Evidence Aggregation Optimization

## Objective

Phase 20.3 optimizes the ticket evidence aggregation bottleneck identified in Phase 20.2. The phase is limited to read-only reporting and load-testing evidence aggregation.

No ticket purchase writes, wallet reservation writes, settlement logic, ledger posting, credit calculations, authority routing, rollback behavior, event contracts, or public API contracts are changed.

## Phase 20.2 Bottleneck

The Phase 20.2 bottleneck report identified:

- Scenario: `TICKET_PURCHASES`
- Concurrency: `250`
- Step: `TICKET_EVIDENCE`
- Report P95: `1193.766ms`
- Report P99: `1194.822ms`
- Report max: `1195.206ms`
- QA confirmation P95: `1071.697ms`
- QA confirmation P99: `1080.237ms`
- QA confirmation max: `1093.717ms`

The likely source was ticket evidence aggregation.

## Methodology

The original load-testing harness executed one ticket evidence query per concurrent probe. Phase 20.3 keeps the same public load-testing response contract but loads a bounded ticket evidence snapshot once per ticket-purchase scenario and reuses that evidence in memory for the concurrent aggregation phase.

The optimization preserves:

- Ticket evidence visibility.
- Scenario latency, throughput, CPU, memory, result count, and step measurements.
- Existing protected operations APIs.
- Financial counts and authority state.

## Optimizations Kept

- Bounded ticket evidence snapshot for the `TICKET_PURCHASES` scenario.
- In-run reuse of ticket evidence for concurrent reporting probes.
- Before/after measurement through `ops:ticket-evidence-optimization-report`.

## Optimizations Reverted

No optimization was kept that required write-path changes, schema/index changes, public API response changes, financial behavior changes, or historical evidence mutation.

## Behavior Preservation

This phase is measurement and reporting only. It does not create tickets, reserve wallets, settle tickets, post ledger entries, mutate credit state, publish events, change authority, or alter rollback readiness.

## Validation

Use:

```bash
npm run ops:ticket-evidence-optimization-report
npm run qa:ticket-evidence-optimization
```

The QA verifies protected APIs, unchanged response contracts, visible ticket evidence, unchanged financial counts, unchanged authority/certification state, and measurable improvement for the ticket evidence target.

## Remaining Bottlenecks

After ticket evidence optimization, remaining bottlenecks should be identified by the concurrency bottleneck report before any additional optimization is attempted.

## Recommendation

Use Phase 20.4 to re-run bottleneck identification and target only the next confirmed read-only evidence path.
