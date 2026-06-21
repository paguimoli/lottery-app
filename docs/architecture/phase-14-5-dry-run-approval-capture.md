# Phase 14.5 - Dry-Run Approval Capture

## Purpose

Phase 14.5 adds the controlled, auditable mechanism for an authorized operator to approve Settlement authority dry-run readiness.

This phase records approval only.

It does not:

- promote Settlement Service
- change `SETTLEMENT_AUTHORITY`
- route settlements to Settlement Service
- disable monolith settlement
- change financial calculations
- change readiness thresholds

## Approval Meaning

`DRY_RUN_APPROVAL` means an authorized operator has reviewed the current promotion decision and agrees that Settlement authority is ready to move to the next approval stage.

The approval is not a promotion approval.

After capture, the promotion decision advances from:

`READY_FOR_DRY_RUN_APPROVAL`

to:

`READY_FOR_PROMOTION_APPROVAL`

Authority remains `MONOLITH`.

## API

`POST /api/authority/approvals/dry-run`

Request:

```json
{
  "domain": "SETTLEMENT",
  "justification": "Operator reviewed promotion readiness and approves dry-run readiness.",
  "acknowledgedWarnings": [
    "Raw evidence is not READY and must remain visible for review."
  ],
  "correlationId": "optional-correlation-id"
}
```

The endpoint requires existing administrative authorization.

## Validation Rules

Approval is rejected unless:

- domain is `SETTLEMENT`
- promotion decision is `READY_FOR_DRY_RUN_APPROVAL`
- rollback readiness is `READY`
- comparison mode is `ENABLED`
- current authority is `MONOLITH`
- justification is non-empty
- the raw-evidence warning is acknowledged when present

## Idempotency

If `correlationId` is supplied and a matching Settlement `DRY_RUN_APPROVAL` already exists, the endpoint returns the existing approval record.

No new approval row or outbox event is created for the repeated request.

## Audit And Outbox

Approval records are append-only in `authority_approval_records`.

The operation emits the outbox event:

`authority.dry_run.approved`

Payload:

- domain
- actorUserId
- approvalId
- correlationId
- createdAt

The event is stored through the outbox pattern. There is no direct RabbitMQ publishing.

## Operations Command

```bash
npm run ops:approve-settlement-dry-run -- \
  --justification "Operator reviewed lifecycle-adjusted evidence and approves dry-run readiness." \
  --acknowledge-warning "Raw evidence is not READY and must remain visible for review." \
  --correlation-id "ops-settlement-dry-run-approval-001"
```

## Next Step

After `DRY_RUN_APPROVAL`, operators must review dry-run evidence and capture a future `PROMOTION_APPROVAL` before any controlled promotion phase.

No automatic authority transfer occurs.

