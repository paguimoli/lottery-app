# Phase 14.2 - Settlement Authority Dry-Run & Operator Approval

## Purpose

Phase 14.2 adds the final operator approval layer required before any future Settlement authority promotion.

This phase does not transfer authority. The monolith remains authoritative and the Settlement Service remains comparison-only.

## Candidate States

Settlement authority promotion candidates use these explicit states:

- `BLOCKED`
- `READY_FOR_REVIEW`
- `APPROVED_FOR_DRY_RUN`
- `DRY_RUN_ACTIVE`
- `APPROVED_FOR_PROMOTION`
- `PROMOTED`

The default Settlement state is `READY_FOR_REVIEW` when adjusted shadow evidence is ready, monolith authority remains active, comparison mode remains enabled, and no approval records exist.

## Approval Model

Approvals are represented by append-only `authority_approval_records`.

Fields include:

- authority candidate
- approval type
- approver user id
- approver username
- justification
- metadata
- creation timestamp

Approval types:

- `DRY_RUN_APPROVAL`
- `PROMOTION_APPROVAL`
- `ROLLBACK_APPROVAL`

The database migration prevents updates and deletes on approval records. This phase exposes read-only APIs only.

## Dry-Run Evaluation

The dry-run evaluation answers:

- Would rollback trigger if Settlement Service became authoritative right now?
- Would thresholds be exceeded?
- Would promotion be allowed?

The evaluation reports raw and adjusted evidence separately. Adjusted evidence may explain QA-only blockers, but it does not relax rollback protections or readiness thresholds.

## Protected APIs

All endpoints require existing `system.admin` permission:

- `GET /api/authority/approval-status`
- `GET /api/authority/approval-history`
- `GET /api/authority/dry-run-evaluation`

No mutation endpoints are introduced.

## Operations Scripts

- `npm run ops:authority-approval-status`
- `npm run ops:authority-approval-history`
- `npm run ops:settlement-dry-run-evaluation`

## Reporting

Reports include:

- Current state
- Recommended state
- Promotion blockers
- Rollback readiness
- Approval requirements
- Raw shadow evidence
- Adjusted shadow evidence

## Promotion Rules

Promotion remains blocked unless all are true:

- Settlement authority remains controlled and explicitly promoted in a future phase.
- Dry-run approval exists.
- Promotion approval exists.
- Rollback readiness is not blocked.
- Raw rollback trigger evaluation is clean.
- Adjusted readiness is ready.
- Operators have reviewed approval history and runbooks.

## Validation

Validation command:

```bash
npm run qa:settlement-authority-dry-run
```

The QA script verifies:

- Protected APIs require auth.
- Settlement state is reported.
- Approval history is returned.
- Dry-run evaluation is returned.
- Promotion is not allowed without approvals.
- Approval APIs are read-only.
