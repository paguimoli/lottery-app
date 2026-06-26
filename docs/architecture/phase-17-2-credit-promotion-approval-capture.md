# Phase 17.2 - Credit Promotion Approval Capture

## Purpose

Phase 17.2 captures explicit operator promotion approval for Credit Wallet.

This is an approval-only phase. It does not change routing, promote Credit Wallet Service, mutate balances, change reservations, alter exposure, or modify Settlement or Ledger behavior.

## Approval Endpoint

The shared promotion approval endpoint supports `domain = CREDIT`:

```http
POST /api/authority/approvals/promotion
```

Valid payload:

```json
{
  "domain": "CREDIT",
  "justification": "Reviewed Credit dry-run approval and controlled promotion readiness.",
  "acknowledgedWarnings": [
    "Raw evidence is not READY and must remain visible for review.",
    "PROMOTION_APPROVAL is missing."
  ],
  "correlationId": "operator-selected-correlation-id"
}
```

## Prerequisites

Promotion approval is allowed only when:

- Credit authority is `MONOLITH`.
- Credit comparison mode is `ENABLED`.
- Credit rollback readiness is `READY`.
- Credit promotion decision is `READY_FOR_PROMOTION_APPROVAL`.
- Credit `DRY_RUN_APPROVAL` already exists.
- Operator justification is non-empty.
- Every current warning is acknowledged.
- Settlement remains `SERVICE` and `CERTIFIED`.
- Ledger remains `SERVICE` and `CERTIFIED`.

Invalid states are rejected.

## Approval Record

Successful approval records an append-only approval:

- approval type: `PROMOTION_APPROVAL`;
- domain: `CREDIT`;
- actor user id and username;
- justification;
- acknowledged warnings;
- correlation id;
- timestamp.

Approval records are immutable. No update or delete path is introduced.

## Idempotency

`correlationId` provides retry safety:

- first valid request creates the approval;
- retry with the same correlation id returns the existing approval;
- retry does not emit a duplicate approval record.

## Outbox

Successful approval emits:

```text
authority.credit.promotion.approved
```

The event is written to the outbox only. No direct RabbitMQ publish is performed by the approval API.

The payload follows the shared approval schema:

- `domain`;
- `approvalId`;
- `actorUserId`;
- `correlationId`;
- `createdAt`.

## Decision Advancement

After approval, Credit advances from:

```text
READY_FOR_PROMOTION_APPROVAL
```

to:

```text
READY_FOR_CONTROLLED_PROMOTION
```

It must not advance to `PROMOTED`. Credit authority remains `MONOLITH`.

## Relationship To Controlled Promotion

Promotion approval confirms operator acceptance that Credit may proceed to a future controlled-promotion phase.

It does not execute controlled promotion. Any later authority transfer must be implemented as a separate explicit execution step with its own validation, audit event, rollback readiness check, and operator command.

## Validation

Run:

```bash
npm run qa:credit-promotion-approval
npm run qa:credit-promotion-decision
npm run qa:all
```

Expected final Credit state:

- authority: `MONOLITH`;
- comparison: `ENABLED`;
- rollback: `READY`;
- decision: `READY_FOR_CONTROLLED_PROMOTION`.

## Next Phase

Phase 17.3 should implement Credit controlled-promotion simulation or execution readiness, depending on operator policy. It must still keep authority transfer explicit and auditable.
