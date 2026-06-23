# Phase 16.0 - Ledger Authority Transfer Candidate Framework

## Purpose

Phase 16.0 creates the Ledger Authority Transfer Candidate Framework using the completed Settlement authority framework as the reference implementation.

This phase is advisory only. Ledger authority remains with the monolith.

## Current Authority State

| Domain | Authority | Comparison Mode | Phase 16.0 Action |
| --- | --- | --- | --- |
| Settlement | SERVICE | ENABLED | No change |
| Ledger | MONOLITH | ENABLED | Candidate framework only |
| Credit | MONOLITH | ENABLED | No change |

## Ledger Candidate Components

The Ledger framework now exposes:

- Ledger authority readiness.
- Ledger shadow evidence analysis.
- Ledger lifecycle evidence reporting.
- Ledger promotion readiness using raw, adjusted, and lifecycle-effective evidence.
- Ledger promotion decision.
- Ledger dry-run evaluation.
- Ledger rollback readiness.
- Ledger promotion simulation.
- Ledger rollback simulation.

## Evidence Model

Ledger uses the existing shadow evidence model:

- `ledger_shadow_runs`
- `ledger_shadow_mismatches`
- `ledger_shadow_failures`
- `shadow_evidence_lifecycle_events`

Lifecycle statuses:

- `ACTIVE`
- `EXCLUDED_FROM_PROMOTION`
- `ARCHIVED`
- `REVIEW_REQUIRED`

Lifecycle reason codes:

- `QA_INTENTIONAL`
- `QA_FAILURE_TEST`
- `LOAD_TEST`
- `BACKFILL_TEST`
- `OPERATOR_EXCLUDED`
- `EXPIRED_TEST_EVIDENCE`
- `UNEXPLAINED`

## Promotion Decision States

Ledger promotion decisions support:

- `BLOCKED`
- `READY_FOR_REVIEW`
- `READY_FOR_DRY_RUN_APPROVAL`
- `READY_FOR_PROMOTION_APPROVAL`
- `READY_FOR_CONTROLLED_PROMOTION`
- `PROMOTED`

`PROMOTED` is not expected in Phase 16.0 because Ledger authority remains `MONOLITH`.

## APIs

Protected Ledger APIs:

- `GET /api/authority/ledger-readiness`
- `GET /api/authority/ledger-dry-run-evaluation`
- `GET /api/authority/ledger-rollback-readiness`
- `GET /api/authority/ledger-lifecycle/summary`
- `GET /api/authority/ledger-lifecycle/events`
- `GET /api/authority/ledger-approval-status`
- `GET /api/authority/ledger-approval-history`
- `POST /api/authority/ledger-promotion/simulate`
- `POST /api/authority/ledger-rollback/simulate`

Existing generic APIs also support Ledger:

- `GET /api/authority/promotion-decision?domain=ledger`
- `GET /api/shadow-analysis/summary`
- `GET /api/shadow-analysis/mismatches`
- `GET /api/shadow-analysis/failures`

## Operator Scripts

- `ops:ledger-authority-readiness`
- `ops:ledger-promotion-decision`
- `ops:ledger-dry-run-evaluation`
- `ops:simulate-ledger-promotion`
- `ops:simulate-ledger-rollback`

## QA

- `qa:ledger-authority`
- `qa:ledger-shadow-analysis`
- `qa:ledger-lifecycle`
- `qa:ledger-promotion-decision`
- `qa:ledger-dry-run`
- `qa:ledger-promotion-simulation`

These are included in `qa:all`.

## Non-Goals

Phase 16.0 does not:

- Transfer Ledger authority.
- Route Ledger posting to Ledger Service.
- Change financial posting rules.
- Change balance calculation rules.
- Change settlement, wallet, auth, or permission behavior.
- Modify `.env.local`.

## Phase 16.1 Recommendation

Phase 16.1 should focus on Ledger dry-run approval capture only after operators review Ledger shadow evidence, lifecycle exclusions, service health, and rollback readiness.
