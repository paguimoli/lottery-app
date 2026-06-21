# Settlement Authority Approval Runbook

## Purpose

This runbook defines the operator review required before a future Settlement authority promotion.

Phase 14.2 does not perform promotion. It only exposes readiness, approval history, and dry-run evaluation.

## Review Commands

```bash
npm run ops:authority-approval-status
npm run ops:authority-approval-history
npm run ops:settlement-dry-run-evaluation
```

## Pre-Dry-Run Checklist

1. Confirm `SETTLEMENT_AUTHORITY=MONOLITH`.
2. Confirm `SETTLEMENT_COMPARISON_MODE=ENABLED`.
3. Confirm adjusted Settlement readiness is `READY`.
4. Review raw blockers and confirm whether they are QA-only.
5. Confirm rollback readiness is not `BLOCKED`.
6. Record a `DRY_RUN_APPROVAL` through the documented future approval process.

## Pre-Promotion Checklist

1. Confirm dry-run evidence has been reviewed.
2. Confirm no raw rollback trigger would fire.
3. Confirm no unexplained critical mismatch exists.
4. Confirm `PROMOTION_APPROVAL` exists.
5. Confirm rollback operator and rollback window are assigned.
6. Keep rollback approval process available.

## Operator Rules

- Do not promote authority through API.
- Do not edit approval history.
- Do not delete approval history.
- Do not ignore raw readiness blockers.
- Do not treat adjusted readiness as automatic promotion approval.

## Emergency Rollback Review

Rollback approval is required before planned rollback actions. Emergency rollback procedures must still preserve audit records, correlation IDs, and post-incident reconciliation.
