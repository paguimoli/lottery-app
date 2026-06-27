# Phase 19.2 - Database Performance Telemetry & Query Baseline

## Purpose

Phase 19.2 establishes the production database performance baseline used before any database optimization. It is measurement-only and does not add indexes, rewrite queries, change repositories, alter schema, modify migrations, or change financial behavior.

The Phase 19.0 baseline remains the comparison anchor:

- average sampled database latency: approximately `811ms`
- slowest sampled query: approximately `946ms`
- connection pool metrics: unavailable
- transaction duration visibility: limited

## Measurement Methodology

The database performance domain performs read-only application-level sampling through the existing Supabase service-role client. It measures representative platform tables used by wallet, ledger, credit, outbox, authority, worker, and shadow evidence workflows.

For each sampled query, the report records:

- label
- table
- operation
- access type
- repository and API association
- start and completion timestamps
- duration
- row count
- status and error, if unavailable

Sampling is intentionally observational. It does not create rows, update rows, delete rows, retry events, dispatch queues, or execute write RPCs.

## Query Latency

The report aggregates:

- average duration
- median duration
- P95
- P99
- minimum
- maximum
- query count
- queries/sec
- reads/sec
- writes/sec
- read/write ratio

The slow query report includes a histogram and top slow queries. These are candidates for future explain-plan analysis, not automatic optimization.

## Connection Pool Metrics

Connection pool metrics are returned as structured telemetry even when native database access is unavailable.

In the current Supabase REST environment, the app cannot read `pg_stat_activity` or pooler internals without additional database-native telemetry access. The report therefore marks:

- active connections: unavailable
- idle connections: unavailable
- waiting connections: unavailable
- pool utilization: unavailable
- pool exhaustion events: unavailable

This distinction is intentional: unavailable is not treated as healthy or unhealthy.

## Transaction Metrics

Transaction metrics are based on read-only application sampling unless native database telemetry is later exposed.

The report includes:

- sampled transaction count
- transaction frequency
- average sampled duration
- max sampled duration
- sampled transaction size by returned rows
- lock waits as unavailable when native telemetry is unavailable

Native lock waits, concurrent transaction state, and longest-running transaction require read-only database-native views.

## Repository Hotspots

Repository hotspots are generated with static source analysis of `src/domains`. The scanner counts read and write database indicators and combines them with direct sampled measurements where a sampled query maps to a repository area.

This ranking identifies where future instrumentation should become more precise. It is not a query optimization recommendation by itself.

## Endpoint Hotspots

API hotspots are generated with static source analysis of `app/api` route handlers and direct sampled endpoint associations.

The ranking helps decide where future endpoint-level database timing should be added under controlled load.

## Known Limitations

- Supabase REST does not expose full pooler telemetry in this environment.
- Lock waits and native transaction concurrency are unavailable without read-only database-native views.
- Static repository and API rankings are indicators, not exact runtime call counts.
- No database schema changes were made to support this phase.
- No business or financial behavior changed.

## Future Optimization Candidates

Phase 19.3 should choose one measured bottleneck and optimize only after capturing a before/after comparison. Candidate work:

- add database-native read-only telemetry for pool and transaction visibility
- run explain-plan analysis for the slowest measured query
- add endpoint-level DB timing around the highest-ranked API hotspots
- add repository-level timing around the highest-ranked repository hotspots
- evaluate index changes only after a measured slow query and explain plan justify them
