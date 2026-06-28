# Phase 21.2 - Retry, Idempotency, and Restart Validation

Phase 21.2 validates retry and restart safety after core financial authority
promotion and certification. The phase is evidence-only: it does not alter
authority routing, retry semantics, event contracts, financial calculations, or
production persistence.

## Validation Methodology

The validation uses protected read-only operations APIs:

- `GET /api/operations/idempotency-validation`
- `GET /api/operations/retry-validation`
- `GET /api/operations/event-replay-status`

The APIs sample existing operational evidence from outbox events, worker
heartbeats, queue health, retry counters, idempotency records, tickets,
settlements, ledger entries, and credit reservations. They verify that sampled
retry and replay evidence has not produced duplicate financial effects.

## Scenarios Tested

The retry validation report covers:

- Outbox dispatcher restart
- RabbitMQ reconnect
- Worker restart
- Duplicate message delivery
- Dispatcher restart during publish
- Worker restart during processing
- Multiple consumer retry
- Replay of already processed events
- Duplicate HTTP retry where idempotency evidence exists

Each scenario is marked read-only and reports the evidence used to classify it.

## Recovery Evidence

Recovery evidence is derived from:

- Fresh outbox dispatcher heartbeat evidence
- Active worker heartbeat evidence
- RabbitMQ queue and consumer metrics when available
- Outbox pending, failed, dead-letter, retry, and published counts
- Worker processing and failure observations
- Existing Phase 21 recovery baseline status

Historical stale workers remain advisory evidence and are not treated as active
failure when fresh workers are visible.

## Replay Evidence

Replay protection is verified through:

- Duplicate outbox event ID checks
- Duplicate published event ID checks
- Correlation ID evidence in outbox events
- Idempotency key evidence in idempotency records and financial tables
- Published event sampling

Repeated event fingerprints are reported as advisory review evidence because
some event types may legitimately recur for the same aggregate over time.

## Duplicate Prevention Evidence

The validation reports duplicate counts for:

- Outbox events
- Tickets
- Credit-backed settlement applications
- Ledger entries
- Credit reservations

A nonzero duplicate count blocks the validation and requires operator review.

## Known Limitations

This phase validates existing evidence and the state after the compose rebuild
and worker restart cycle used by QA. It does not inject duplicate RabbitMQ
messages, pause a dispatcher mid-publish, kill workers mid-handler, or alter
queue delivery semantics from the application API itself.

## Recommendation For Phase 22

Proceed to Phase 22 only if `qa:idempotency-validation`,
`qa:recovery-drills`, and `qa:all` pass with no duplicate financial effects.
Future resilience work can add explicitly operator-approved fault-injection
drills for duplicate RabbitMQ delivery and mid-handler termination.
