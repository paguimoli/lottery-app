# Settlement Service Contract

## Purpose

This contract defines the internal Settlement boundary that will later map to an extracted Settlement Service. Production traffic remains in the monolith in Phase 13.2.

## Ownership

Settlement owns:

- Settlement execution orchestration.
- Settlement result application.
- Settlement recovery and resume behavior.
- Resettlement and reversal orchestration as it matures.
- Settlement audit traceability and emitted settlement events.

Settlement does not own credit reservation math, ledger balance posting, wallet policy, commission calculation, accounting close, player lifecycle, cashier lifecycle, or authentication.

## Commands

### Execute Settlement

Internal entry point: `executeSettlement`

Input:

- Settlement run.
- Drawing and game identifiers.
- Eligible tickets and ticket lines.
- Wager definitions and pay table data.
- Official result data.
- Actor context when settlement is manually triggered.
- Correlation ID when settlement is triggered by API, worker, or result posting flow.
- Optional existing settlement records.
- Optional execution ID.

Output:

- Settlement execution summary.
- Settlement records.
- Updated ticket and line states.
- Execution errors.
- Credit effects produced by Credit Wallet entrypoints.
- Ledger effects produced by Ledger entrypoints when explicit ledger commands are supplied.
- Outbox events from downstream Credit/Ledger workflows where those contracts emit them.

Requirements:

- Uses integer minor-unit money values.
- Does not directly write credit or ledger repositories.
- Credit-backed records are applied through `applyCreditSettlement` from the Credit entrypoint.
- Settlement does not manufacture legacy in-memory ledger transactions.
- Wallet-backed ledger posting must use `postLedgerEntry` through the Ledger entrypoint and must include wallet ID, idempotency key, reference, and correlation metadata.

Events:

- Settlement events through existing outbox paths where integrated.
- `credit.settlement.applied` and `credit.balance.updated` are emitted by the Credit contract for credit-backed settlement application.
- Ledger events are emitted by the Ledger contract when actual ledger commands are posted.

Idempotency:

- Settlement record IDs and existing settlement records protect line-level reprocessing.
- Credit settlement uses deterministic per-record idempotency keys.
- Ledger posting requires caller-provided idempotency keys before any command can be posted.

Retry behavior:

- Retrying settlement is safe when existing records are supplied.
- Credit application retries are safe through Credit Wallet idempotency.
- Ledger command retries are safe only with Ledger idempotency keys.

Replay behavior:

- Replay reconstructs settlement records, credit applications, ledger entries, audit records, and outbox events by correlation ID and source references.

Failure behavior:

- Credit failure on a credit-backed ticket marks the settlement run failed and includes ticket, reservation, settlement record, and correlation context in logs/errors.
- Ledger posting failure must fail the enclosing operation. Settlement must not silently treat a failed financial effect as complete.

External endpoint mapping:

- `POST /v1/settlements/runs/{runId}/execute`

### Resume Settlement

Internal entry point: `resumeSettlement`

Input:

- Same contract as execute settlement.

Output:

- Settlement execution result with recovery execution ID.

Retry safety:

- Existing settlement records must prevent duplicate line processing.

External endpoint mapping:

- `POST /v1/settlements/runs/{runId}/resume`

### Apply Settlement Results

Internal entry point: `applySettlementResults`

Input:

- Settlement records.
- Tickets.
- Currency.
- Optional correlation ID.

Output:

- Per-record credit application results.

Requirements:

- Only credit-backed tickets with reservation IDs are applied to Credit Wallet.
- Non-credit tickets remain unchanged.
- Credit release failures must be visible and not silently treated as complete.
- Balance impact is owned by Credit Wallet for credit-backed tickets.

External endpoint mapping:

- `POST /v1/settlements/results/apply`

### Reverse Or Resettle

Internal entry points:

- `reverseSettlementRecordsForResettlement`
- `executeResettlement`

Current status:

- Available in monolith as resettlement helpers.
- Reversal settlement records are append-only.
- Legacy in-memory ledger reversals were removed in Phase 13.2.
- Future real ledger reversals must use Ledger `reverseLedgerEntry` with persisted ledger entry IDs.

External endpoint mapping:

- `POST /v1/settlements/runs/{runId}/resettle`

## Correlation And Actor Requirements

Settlement execution should carry a correlation ID from result posting through credit application, ledger effects, audit records, and outbox events. Actor requirements depend on whether settlement is automated, manual, or resettlement-driven.

Automated settlement actor:

- `system` or worker identity.

Manual settlement actor:

- Authenticated operator/admin user ID.

Resettlement actor:

- Authenticated admin plus approval context when required.

## Extraction Notes

The first extracted Settlement Service should call Credit Wallet and Ledger boundaries instead of importing repositories. Phase 13.2 removed settlement's legacy in-memory ledger helper coupling, so the remaining extraction work is contract implementation, persistence ownership, monitoring, and rollout controls rather than hidden financial shortcuts.
