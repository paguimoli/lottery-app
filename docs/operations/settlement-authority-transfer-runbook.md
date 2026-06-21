# Settlement Authority Transfer Runbook

## Current State

The monolith remains authoritative for settlement.

The Settlement Service remains comparison-only.

## Readiness Check

Run:

```bash
npm run ops:settlement-authority-readiness
```

Review:

- authority
- comparison mode
- dry-run mode
- mismatch rate
- failure rate
- rollback readiness
- remaining blockers

## Dry-Run Check

Run:

```bash
npm run ops:settlement-authority-dry-run
```

The output must show:

```text
productionCutoverActive=false
authoritativePath=MONOLITH
comparisonPath=SETTLEMENT_SERVICE
```

## Future Cutover Preconditions

- `qa:all` passes.
- Settlement authority readiness is `READY`.
- Rollback readiness is `READY`.
- Shadow mismatch and failure rates are below thresholds.
- No critical mismatches are present.
- Reconciliation has no unresolved blocking findings.
- Operators have approved a rollback owner and rollback window.

## Rollback Evaluation

Rollback trigger evaluation is advisory until a future phase explicitly transfers authority.

If the trigger indicates rollback would be required:

1. Keep authority as `MONOLITH`.
2. Review settlement shadow mismatches and failures.
3. Run reconciliation.
4. Do not repair financial state automatically.

## Emergency Rules

- Do not switch settlement authority by API.
- Do not disable comparison mode during transfer evaluation.
- Do not bypass outbox.
- Do not manually edit settlement, ledger, or credit financial records.
