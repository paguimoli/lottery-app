# Phase 12.9 - Workload Isolation & Queue Topology

## Purpose

Phase 12.9 introduces the first production workload isolation layer for event processing. The goal is to keep critical financial, credit, ticket, and settlement events from competing with slower operational workloads such as reporting, reconciliation review, accounting, and commission processing.

This phase does not change financial math, credit reservation math, settlement math, accounting math, commission math, authentication, or authorization.

## Queue Topology

All business code continues to write `outbox_events`. The outbox dispatcher remains the only RabbitMQ publisher path. The dispatcher classifies each outbox event by event type and publishes it to the RabbitMQ topic exchange using the centralized topology in `src/lib/queue/queue-topology.ts`.

| Workload | Routing Pattern | Queue | DLQ | Priority | Consumer Owner |
| --- | --- | --- | --- | --- | --- |
| `CRITICAL_FINANCIAL` | `financial.#` | `lottery.critical-financial.events` | `lottery.critical-financial.events.dlq` | High | `critical-financial-worker` |
| `TICKET_LIFECYCLE` | `ticket.#` | `lottery.ticket-lifecycle.events` | `lottery.ticket-lifecycle.events.dlq` | High | `ticket-lifecycle-worker` |
| `SETTLEMENT` | `settlement.#` | `lottery.settlement.events` | `lottery.settlement.events.dlq` | High | `settlement-worker` |
| `ACCOUNTING` | `accounting.#` | `lottery.accounting.events` | `lottery.accounting.events.dlq` | Normal | `accounting-worker` |
| `COMMISSION` | `commission.#` | `lottery.commission.events` | `lottery.commission.events.dlq` | Normal | `commission-worker` |
| `RECONCILIATION` | `reconciliation.#` | `lottery.reconciliation.events` | `lottery.reconciliation.events.dlq` | Low | `reconciliation-worker` |
| `OPERATIONAL_ACCESS` | `operational-access.#` | `lottery.operational-access.events` | `lottery.operational-access.events.dlq` | High | `operational-access-worker` |
| `REPORTING_LOW_PRIORITY` | `reporting.#` | `lottery.reporting-low-priority.events` | `lottery.reporting-low-priority.events.dlq` | Low | `reporting-worker` |

## Event Classification

Classification is deterministic:

- `ledger.*`, `wallet.*`, `credit.reservation.*`, `credit.settlement.applied`, and `credit.balance.*` map to `CRITICAL_FINANCIAL`.
- `ticket.accepted`, `ticket.cancelled`, and `ticket.settled` map to `TICKET_LIFECYCLE`.
- `settlement.*` maps to `SETTLEMENT`.
- `accounting.*` maps to `ACCOUNTING`.
- `commission.*` maps to `COMMISSION`.
- `reconciliation.*` maps to `RECONCILIATION`.
- `break_glass.*`, `session.*`, and `user.sessions.*` map to `OPERATIONAL_ACCESS`.
- `report.*` and unknown events map to `REPORTING_LOW_PRIORITY`.

Unknown events are intentionally isolated from critical queues.

## Retry and DLQ Policy

Retry policy is category-aware:

- High-priority financial, ticket, settlement, and operational access events retry up to five attempts and then move to DLQ.
- Accounting and commission events retry up to four attempts and then move to DLQ.
- Reconciliation and reporting events retry up to three attempts and then move to DLQ.

No event is silently dropped. DLQ counts are surfaced through queue health.

## Ticket Accepted Coverage

Successful ticket acceptance now emits `ticket.accepted` through the outbox pattern.

Payload includes:

- `ticketId`
- `reservationId`
- `playerId`
- `stake`
- `amount`
- `currency`
- `correlationId`
- `createdAt`

The migration updates `place_ticket_with_wallet_debit(...)` so direct RPC placement emits the event after the migration is applied. The HTTP ticket endpoint also includes a duplicate-safe outbox backstop.

## Worker Separation

The following scripts can start isolated workload consumers:

- `npm run worker:critical-financial`
- `npm run worker:ticket-lifecycle`
- `npm run worker:settlement`
- `npm run worker:accounting`
- `npm run worker:commission`
- `npm run worker:reconciliation`
- `npm run worker:operational-access`
- `npm run worker:reporting`

These consumers currently log and acknowledge messages through the established consumer success path. They do not call business services in this phase.

## Queue Health Visibility

`GET /api/operations/queues/health` is protected by `system.admin` permission and returns:

- outbox pending count
- outbox failed count
- outbox dead-letter count
- oldest unpublished outbox age
- failed job count
- RabbitMQ ready count by queue
- RabbitMQ unacked count by queue
- DLQ ready/unacked count by queue
- topology metadata

`npm run ops:queue-health` prints the same operational summary when supplied an admin session token.

## Limitations

- This phase does not auto-scale workers.
- This phase does not add Kubernetes or new infrastructure.
- Queue priority is operationally modeled by separate queues, not RabbitMQ message priority.
- Existing historical tickets are not backfilled with `ticket.accepted`; new accepted tickets are covered.
- DLQ remediation remains manual and must follow the operations runbook.
