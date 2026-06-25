# Phase 17.0 - Credit Wallet Authority Transfer Candidate Framework

## Purpose

Credit Wallet remains monolith-authoritative. This phase prepares the authority transfer framework so operators can evaluate Credit Wallet as a future promotion candidate without changing routing, balances, reservations, settlement application, Ledger posting, or accounting.

No authority transfer occurs in this phase.

## Authority Model

Initial Credit Wallet authority state:

- authority: `MONOLITH`
- comparison mode: `ENABLED`
- rollback readiness: `READY`
- promotion decision: `READY_FOR_DRY_RUN_APPROVAL`

The authoritative path remains the monolith. Credit Wallet Service is used only as the comparison path while comparison mode is enabled.

## Comparison Model

Credit shadow execution evidence is evaluated through the shared shadow analysis pipeline:

- `RAW_READINESS`: all raw Credit shadow evidence remains visible.
- `ADJUSTED_READINESS`: intentional QA evidence is excluded from adjusted operational readiness.
- `PROMOTION_READINESS`: lifecycle-effective evidence drives promotion eligibility.
- `POST_PROMOTION_EVIDENCE`: reserved for future post-promotion Credit monitoring.

Intentional QA evidence must remain retained and visible for audit, but lifecycle exclusions prevent known QA evidence from blocking promotion readiness.

## Promotion Lifecycle

Phase 17.0 supports candidate evaluation only:

1. Review Credit authority readiness.
2. Review Credit shadow analysis and lifecycle summary.
3. Review Credit promotion decision.
4. Review dry-run evaluation.
5. Run promotion simulation.

Promotion simulation emits `authority.credit.promotion.simulated` through the outbox. It does not change authority, routes, balances, reservations, settlement application, Ledger posting, or accounting.

## Rollback Lifecycle

Rollback readiness confirms:

- monolith path is available
- comparison mode is enabled
- authority controls are readable
- Credit Wallet Service health is visible
- lifecycle-effective rollback evidence is clear

Rollback simulation emits `authority.credit.rollback.simulated` through the outbox. It does not execute rollback or mutate authority.

## Readiness Evaluation

Credit readiness evaluates:

- current authority
- comparison mode
- rollback readiness
- Credit Wallet Service health
- raw, adjusted, and promotion shadow evidence
- lifecycle exclusions
- blockers and warnings

The expected Phase 17.0 decision is `READY_FOR_DRY_RUN_APPROVAL`.

## Operator Workflow

Run:

```bash
npm run ops:credit-authority-readiness
npm run ops:credit-promotion-decision
npm run ops:credit-dry-run-evaluation
npm run ops:simulate-credit-promotion
npm run ops:simulate-credit-rollback
```

Expected:

- Credit remains `MONOLITH`
- comparison remains `ENABLED`
- rollback remains `READY`
- promotion decision is `READY_FOR_DRY_RUN_APPROVAL`
- simulations create audit-only outbox evidence

Phase 17.1 should add explicit Credit dry-run approval capture. It must still avoid authority promotion.
