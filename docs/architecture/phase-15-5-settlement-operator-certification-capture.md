# Phase 15.5 - Settlement Operator Certification Capture

## Purpose

Settlement Service has completed enough post-promotion activity to be ready for formal operator certification. This phase records that certification as an append-only approval.

This phase does not change authority. Settlement remains service-authoritative, comparison remains enabled, and rollback remains available.

## Certification Approval

Certification is captured as an authority approval record:

- `authority_candidate = SETTLEMENT`
- `approval_type = SETTLEMENT_CERTIFICATION`

Approval records remain append-only:

- no updates
- no deletes
- immutable audit history

## Preconditions

Certification is allowed only when:

- Settlement authority is `SERVICE`
- comparison mode is `ENABLED`
- rollback readiness is `READY`
- certification status is `READY_FOR_CERTIFICATION`
- Settlement Service health is available
- post-promotion failures are `0`
- post-promotion critical mismatches are `0`
- operator justification is present
- certification warnings are acknowledged

## API

`POST /api/authority/certification/settlement`

Input:

```json
{
  "justification": "Operator reviewed stabilization evidence.",
  "acknowledgedWarnings": [
    "Operator certification is still required before marking Settlement as CERTIFIED."
  ],
  "correlationId": "optional"
}
```

If `correlationId` is supplied, certification capture is idempotent for that correlation id.

## Audit Event

Successful certification emits:

`authority.settlement.certified`

Payload:

- `approvalId`
- `actorUserId`
- `correlationId`
- `certifiedAt`

The event is written through the existing outbox pattern. It is not published directly.

## Certification Status

`GET /api/authority/settlement-stabilization-status` now includes:

- `certificationStatus`
- `certificationApprovalId`
- `certifiedAt`

After successful certification, status becomes `CERTIFIED`.

## Meaning Of CERTIFIED

`CERTIFIED` means an authorized operator accepted Settlement Service as the certified Settlement authority after reviewing stabilization evidence.

It does not mean:

- Ledger authority changed
- Credit authority changed
- comparison mode can be disabled
- rollback controls can be removed
- monolith comparison execution can be deleted

## Validation

Run:

```bash
npm run qa:settlement-certification
npm run ops:settlement-certification-status -- --window 7d
```

Expected:

- endpoint requires authentication
- missing justification is rejected
- valid certification creates or returns an append-only approval
- status becomes `CERTIFIED`
- authority remains `SERVICE`
- comparison remains `ENABLED`
- rollback readiness remains `READY`
