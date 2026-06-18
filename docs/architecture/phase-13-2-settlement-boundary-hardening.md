# Phase 13.2 - Settlement Financial Boundary Hardening

## Purpose

Phase 13.2 removes the settlement extraction blocker identified in Phase 13.1: settlement financial effects previously depended on legacy in-memory ledger helper behavior. This phase keeps production execution in the monolith while ensuring settlement only reaches financial domains through documented Ledger and Credit boundaries.

## Settlement Financial Flow Audit

| Path | Previous Behavior | Target Behavior | Remediation |
| --- | --- | --- | --- |
| Settlement execution controller | Created in-memory `LedgerTransaction` records with `settlement-ledger.service.ts` and appended them with `saveLedgerTransactions`. | Do not create helper ledger records. Credit-backed balance/exposure effects flow through Credit Wallet. Real ledger posting must use Ledger entrypoints with wallet IDs. | Removed legacy helper usage and replaced with `settlement-financial-effects.service.ts`. |
| Settlement resume controller | Reused the same legacy in-memory ledger helper path. | Same as execution controller. | Replaced with the new financial-effects adapter. |
| Resettlement | Created in-memory settlement reversal ledger transactions and corrected ledger transactions. | Reversal settlement records remain append-only. Future real ledger reversals must use Ledger `reverseLedgerEntry` with persisted ledger entry IDs. | Removed in-memory ledger reversal generation. |
| Credit-backed settlement | Called `applyCreditSettlementForRecords`, which called the Credit service. | Call Credit through the approved Credit entrypoint. | Updated settlement credit adapter to import `credit.entrypoints`. |
| Ledger posting | No wallet-backed persisted ledger posting occurred in settlement. Legacy helper records were not the hardened ledger source of truth. | Ledger effects must use `postLedgerEntry` through `ledger.entrypoints` when explicit wallet-backed commands are available. | Added `applySettlementLedgerEffects` adapter that uses Ledger entrypoints for explicit commands and otherwise returns no ledger effects. |

## Existing Path

Settlement evaluates ticket lines and produces settlement records. For credit-backed tickets, settlement applies exposure release and balance impact through Credit Wallet. Previously, the controller also built legacy in-memory ledger transactions for operational display/history.

Those in-memory transactions were not the hardened `financial_ledger_entries` source of truth and did not use the atomic ledger RPC. They were therefore a hidden extraction blocker.

## Target Path

Settlement owns settlement records and orchestration.

Credit Wallet owns:

- reservation release
- settlement-linked balance impact
- credit summary changes

Ledger owns:

- immutable ledger entries
- reversals
- audit trail for persisted ledger entries

Settlement may request Ledger effects only through:

- `postLedgerEntry`
- `reverseLedgerEntry`
- `getLedgerTransaction`
- `getLedgerAuditTrail`

Settlement may request Credit effects only through:

- `applyCreditSettlement`
- `releaseCreditExposure`
- `cancelCreditReservation`
- `getPlayerCreditSummary`

## Remediation Performed

- Deleted `src/domains/settlement/settlement-ledger.service.ts`.
- Removed settlement imports of legacy ledger helpers and ledger repository internals.
- Removed in-memory ledger transaction creation from settlement execution and resume.
- Removed in-memory ledger reversal creation from resettlement.
- Added `src/domains/settlement/settlement-financial-effects.service.ts`.
- Updated settlement credit adapter to import Credit through `credit.entrypoints`.
- Updated settlement contract documentation with idempotency, retry, replay, failure, actor, correlation, credit effect, ledger effect, and outbox expectations.
- Added `scripts/qa/settlement-boundary-hardening.mjs`.

## Remaining Coupling

| Coupling | Severity | Rationale | Removal Plan |
| --- | --- | --- | --- |
| Settlement repository remains an in-memory domain persistence adapter. | Low | It is settlement-internal and not a financial shortcut. | Replace during persisted Settlement Service implementation. |
| Settlement financial-effects adapter imports Ledger entrypoint. | Low | This is the approved boundary. | Keep until extracted service calls Ledger API instead. |
| Credit settlement adapter imports Credit entrypoint. | Low | This is the approved boundary. | Keep until extracted service calls Credit Wallet API instead. |
| App UI may still maintain local legacy ledger state for display. | Medium | This is outside settlement financial posting and does not mutate financial source-of-truth tables. | Replace with persisted Ledger/Audit reads before production operator UI hardening. |

No settlement imports of Ledger repository, Ledger helper, Ledger types, Credit repository, or Credit service internals remain.

## Idempotency And Retry

Settlement line processing remains protected by existing settlement records. Credit settlement application keeps deterministic per-record idempotency keys. Ledger posting through the new adapter requires explicit Ledger commands, and those commands must carry idempotency keys before they are used for wallet-backed posting.

## Replay And Audit

Replay should reconstruct:

- settlement run
- settlement records
- credit settlement application
- credit reservation release
- credit balance update
- ledger entries when posted through Ledger entrypoints
- outbox events and correlation chain

The phase does not auto-repair missing financial state.

## Extraction Readiness Reassessment

| Capability | Ledger | Credit Wallet | Settlement |
| --- | --- | --- | --- |
| Data ownership clarity | PARTIAL | PARTIAL | PARTIAL |
| API/command boundary | PARTIAL | PARTIAL | READY |
| Idempotency | READY | READY | PARTIAL |
| Outbox/event coverage | PARTIAL | READY | PARTIAL |
| Repository isolation | PARTIAL | PARTIAL | READY |
| Test coverage | PARTIAL | PARTIAL | PARTIAL |
| Operational metrics | PARTIAL | PARTIAL | PARTIAL |
| Rollback path | READY | READY | READY |
| Migration complexity | PARTIAL | PARTIAL | PARTIAL |

Overall:

- Ledger: PARTIAL
- Credit Wallet: PARTIAL
- Settlement: PARTIAL

Settlement is no longer blocked by legacy ledger helper coupling. It remains partial because persisted service ownership, external API routing, operational metrics, and migration rollout are not implemented yet.

## Validation Checklist

- Settlement contract exists.
- Settlement uses Ledger entrypoints for ledger effects.
- Settlement uses Credit entrypoints for credit effects.
- Settlement does not import Ledger repository.
- Settlement does not import Credit repository.
- Settlement does not import legacy Ledger helpers.
- Legacy settlement ledger helper file is removed.
- Existing credit launch QA passes.
- Existing worker observability QA passes.
- Existing service boundary QA passes.
