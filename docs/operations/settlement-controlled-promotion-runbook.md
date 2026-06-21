# Settlement Controlled Promotion Runbook

## Purpose

This runbook describes the operator checklist for simulating future Settlement authority promotion and rollback.

Phase 14.7 does not execute promotion. It only validates that the promotion and rollback controls are ready.

## Preconditions

Before simulation:

1. Confirm `SETTLEMENT_AUTHORITY=MONOLITH`.
2. Confirm `SETTLEMENT_COMPARISON_MODE=ENABLED`.
3. Confirm promotion decision is `READY_FOR_CONTROLLED_PROMOTION`.
4. Confirm `DRY_RUN_APPROVAL` exists.
5. Confirm `PROMOTION_APPROVAL` exists.
6. Confirm rollback readiness is `READY`.
7. Confirm Settlement Service health is available.

## Promotion Simulation

Run:

```bash
npm run ops:simulate-settlement-promotion
```

Expected:

- `promotionAllowed=true`
- no blockers
- authority remains `MONOLITH`
- comparison remains `ENABLED`
- outbox event `authority.promotion.simulated` exists

## Rollback Simulation

Run:

```bash
npm run ops:simulate-settlement-rollback
```

Expected:

- `rollbackAllowed=true`
- no blockers
- monolith path available
- rollback readiness `READY`
- outbox event `authority.rollback.simulated` exists

## Operator Checklist

1. Run promotion simulation.
2. Run rollback simulation.
3. Review blockers and warnings.
4. Verify outbox audit events were created.
5. Verify no authority state changed.
6. Verify no routing changed.
7. Record results in the release evidence package.

## Emergency Rollback Procedure

This phase does not enable service authority, but future rollback procedure must preserve:

- approval history
- promotion simulation evidence
- rollback simulation evidence
- outbox audit events
- post-action reconciliation

Emergency rollback must return authority to `MONOLITH`, keep comparison available where possible, and run reconciliation after the rollback.

## Hard Operator Rules

- Do not manually edit approval history.
- Do not delete simulation events.
- Do not change `SETTLEMENT_AUTHORITY` during simulation.
- Do not disable monolith settlement.
- Do not remove rollback controls.

