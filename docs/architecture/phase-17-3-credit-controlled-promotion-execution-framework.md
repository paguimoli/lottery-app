# Phase 17.3 - Credit Controlled Promotion Execution Framework

## Purpose

Phase 17.3 adds the explicit Credit Wallet controlled promotion execution framework.

The phase permits Credit authority to move from `MONOLITH` to `SERVICE` only through a protected execution API or operation script after dry-run and promotion approvals already exist. It does not change wallet calculations, reservation math, exposure math, settlement application, Ledger posting, or accounting behavior.

## Preconditions

Controlled promotion execution requires:

- Settlement authority is `SERVICE` and certification is `CERTIFIED`.
- Ledger authority is `SERVICE` and certification is `CERTIFIED`.
- Credit authority is `MONOLITH`.
- Credit comparison mode is `ENABLED`.
- Credit rollback readiness is `READY`.
- Credit promotion decision is `READY_FOR_CONTROLLED_PROMOTION`.
- Credit Wallet Service health is healthy.
- `DRY_RUN_APPROVAL` exists for `CREDIT`.
- `PROMOTION_APPROVAL` exists for `CREDIT`.
- The operator submits non-empty justification.
- The request uses explicit `mode: "EXECUTE"`.

If Credit is already `SERVICE`, execution is idempotent and returns the current promoted state without creating another promotion event.

## API

`POST /api/authority/credit-promotion/execute`

Payload:

```json
{
  "domain": "CREDIT",
  "mode": "EXECUTE",
  "justification": "Reviewed Credit controlled promotion checklist.",
  "correlationId": "optional-stable-id"
}
```

Behavior:

- requires authenticated admin access;
- supports only `domain: "CREDIT"`;
- rejects missing or non-`EXECUTE` mode;
- rejects missing justification;
- validates approval, readiness, comparison, rollback, and authority preconditions;
- sets Credit authority to `SERVICE` through the runtime authority-control mechanism;
- keeps Credit comparison mode `ENABLED`;
- keeps Settlement and Ledger authorities unchanged;
- emits `authority.credit.promoted` through the outbox.

## Promotion Status

`GET /api/authority/credit-promotion-status`

Returns:

- `domain`;
- `authority`;
- `comparisonMode`;
- `promotedAt`;
- `rollbackReady`;
- `rollbackReadiness`;
- `promotionApprovalId`;
- `evaluatedAt`.

Status metadata is resolved from runtime promotion metadata first, then from the most recent `authority.credit.promoted` outbox event, then from the recorded promotion approval where applicable.

## Operations

Review readiness:

```bash
npm run ops:credit-promotion-status
npm run ops:credit-promotion-decision
```

Execute controlled promotion:

```bash
npm run ops:credit-promote -- \
  --justification "Reviewed Credit controlled promotion checklist and approvals." \
  --correlation-id "change-credit-promotion-001"
```

The operation script calls the protected API and, on success, updates only Credit authority keys in `.env.local`:

- `CREDIT_AUTHORITY=SERVICE`
- `CREDIT_COMPARISON_MODE=ENABLED`

`.env.local` is gitignored and is local runtime configuration evidence, not source-controlled application code.

## Rollback Sequence

Rollback remains a separate controlled operation. Operators should:

1. Confirm `npm run ops:credit-promotion-status` reports Credit `SERVICE` and rollback readiness `READY`.
2. Review rollback simulation with `npm run ops:simulate-credit-rollback`.
3. Follow the active Credit rollback runbook once the rollback execution phase is available.
4. Keep comparison mode enabled through rollback validation.

Phase 17.3 does not add rollback execution. It preserves rollback readiness and records promotion evidence.

## Validation

Run:

```bash
npm run qa:credit-promotion-execution
npm run qa:all
```

The execution QA validates:

- authentication is required;
- invalid mode is rejected;
- missing justification is rejected;
- controlled promotion succeeds when preconditions are valid;
- Credit authority becomes `SERVICE`;
- Credit comparison remains `ENABLED`;
- Settlement remains `SERVICE` and `CERTIFIED`;
- Ledger remains `SERVICE` and `CERTIFIED`;
- rollback readiness remains `READY`;
- repeated execution with the same correlation id is idempotent.

## Post-Promotion Expectations

After execution:

- Credit authority is `SERVICE`.
- Credit comparison remains `ENABLED`.
- rollback remains `READY`.
- Credit decision is `PROMOTED`.
- post-promotion Credit monitoring must continue before certification work begins.

Phase 17.4 should focus on Credit post-promotion activity monitoring and rollback evidence, not certification by assumption.
