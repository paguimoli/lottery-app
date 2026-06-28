# Phase 21.3 - Controlled Fault-Injection Drills

Phase 21.3 validates recovery from controlled infrastructure faults after
Settlement, Ledger, and Credit have been promoted and certified. The phase does
not alter financial logic, authority routing, event contracts, retry semantics,
or database records.

## Methodology

Fault-injection readiness and recovery evidence is exposed through protected
operations APIs:

- `GET /api/operations/fault-injection-status`
- `GET /api/operations/fault-recovery-metrics`
- `POST /api/operations/fault-injection/simulate`

The APIs are read-only. The simulation endpoint requires explicit confirmation,
accepts only approved drill names, rejects unsupported operations, and reports
precheck and recovery evidence. Actual Docker-level restarts are performed only
by an operator through `ops:fault-injection --execute --confirm --drill ...`.

## Faults Executed

Supported drills are:

- Restart outbox dispatcher
- Restart one worker container
- Restart RabbitMQ consumer
- Temporary RabbitMQ disconnect/reconnect
- Temporary Redis disconnect/reconnect
- Restart application container
- Interrupt worker during message handling using controlled test workload
- Duplicate RabbitMQ delivery simulation

The default QA harness exercises approved simulations and verifies recovery
evidence without mutating financial state.

## Recovery Sequence

Before and after each drill, operators must capture:

- Authority and certification state
- Rollback readiness
- Queue depth and worker count
- Dispatcher heartbeat
- RabbitMQ and Redis health
- Outbox pending and published counts
- Ticket, settlement, ledger, wallet, and credit reservation counts
- Duplicate-prevention evidence

## Recovery Timings

Recovery timing is recorded as the elapsed time to collect fresh recovery
metrics after a drill. Host-run operations can additionally report Docker
Compose restart duration for supported services.

## Financial Invariants Verified

The validation verifies:

- Settlement remains `SERVICE / CERTIFIED`
- Ledger remains `SERVICE / CERTIFIED`
- Credit remains `SERVICE / CERTIFIED`
- Comparison remains `ENABLED`
- Rollback remains `READY`
- Ticket, settlement, ledger, wallet, credit reservation, and outbox counts do
  not change during QA validation

## Duplicate Prevention Verification

The validation reports zero duplicates for:

- Events
- Tickets
- Settlements
- Ledger entries
- Credit reservations

Any duplicate count blocks the drill result.

## Replay Verification

Replay protection is verified from idempotency key evidence, correlation ID
evidence, published outbox samples, and duplicate-prevention checks. Repeated
event fingerprints remain advisory because some aggregate events can recur as
part of normal operational history.

## Known Limitations

The application API cannot directly restart Docker containers because it does
not mount the Docker socket. Actual container restarts are intentionally limited
to the operator script and the validation environment. The QA script remains
fully idempotent and simulation-based so it can safely run inside `qa:all`.

## Recommendation For Phase 22

Proceed to Phase 22 after `qa:fault-injection`, `qa:recovery-drills`,
`qa:idempotency-validation`, and `qa:all` pass. Future drills can add
operator-approved synthetic RabbitMQ duplicate delivery with a disposable,
non-financial workload.
