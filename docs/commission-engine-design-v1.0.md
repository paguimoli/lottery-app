# Commission Engine Design v1.0

## 1. Principles

The Commission Engine consumes settlement outputs and ledger outputs to calculate deterministic downline financial rollups and future commission amounts.

Principles:

- Commissions are calculated from settled activity.
- Pending wagers are not settled revenue.
- Hierarchy rollups are deterministic.
- Calculations must be auditable.
- Corrections are additive through reversals.
- Commission calculations must be reproducible historically.
- Commission outputs must reference source settlement and ledger records.
- Historical commission results must not be silently overwritten.

## 2. Hierarchy Model

The platform hierarchy:

```text
Super Master
↓
Master Agent
↓
Master Agent (optional)
↓
Agent
↓
Player
```

Rules:

- Super Master sits at the top.
- Master Agents may contain other Master Agents.
- Master Agents may contain Agents.
- Agents may only contain Players.
- Players cannot contain children.
- Super Master can see the entire hierarchy.
- Master Agents see only their downline.
- Agents see only their direct Players.
- Players see only their own account.

Rollups must follow the current hierarchy for live reports and the historical hierarchy snapshot for historical statements.

## 3. Accounting Modes

### A. Zero Balance

Zero Balance accounts close automatically at weekly reset.

At weekly reset:

Positive balance:

- create `zero_balance_debit`

Negative balance:

- create `zero_balance_credit`

Result:

- balance returns to zero
- weekly figure resets through ledger-backed accounting entries
- original operational activity remains intact

### B. Carry Balance

Carry Balance accounts roll balances forward.

The Agent or finance user manually records:

- deposits
- withdrawals

until balance returns to zero.

Rules:

- No automatic zeroing occurs.
- Prior balance carries into the next period.
- Deposits and withdrawals affect accounting balance, not weekly figure.

## 4. Weekly Cycle

Default weekly reset:

- Monday 02:00

Markets may configure:

- weekly reset day
- weekly reset time
- weekly reset IANA time zone

Default weekly period:

- Start: Monday 02:00
- End: Next Monday 01:59:59

Timezone handling:

- Weekly boundaries use the account or market IANA time zone.
- All stored timestamps should remain UTC.
- Reports convert timestamps into the configured market time zone.

Settlement after close:

- If a wager settles after weekly close, final treatment depends on production policy.
- Recommended first production behavior: recognize settled activity in the period when settlement completes.
- Alternative future behavior: recognize activity in the draw period and generate adjustment records.

Unsettled wagers:

- Unsettled wagers remain pending exposure.
- Unsettled wagers are not included in weekly figure.
- Pending exposure rolls forward until settlement.

## 5. Player Weekly Figure

Weekly Figure is calculated from operational ledger transactions.

Included:

- wins
- losses
- credit adjustments
- debit adjustments
- freeplay wins

Excluded:

- deposits
- withdrawals
- zero balance transactions
- freeplay grants
- freeplay wagers
- freeplay expirations

Formula:

```text
Player Weekly Figure =
  wins
  - losses
  + credit_adjustments
  - debit_adjustments
  + freeplay_wins
```

Notes:

- Deposits and withdrawals affect accounting balance, not weekly figure.
- Zero balance entries close accounting balances, not operational performance.
- The formula must be reproducible from immutable ledger transactions.

## 6. Pending Exposure

Definition:

```text
Pending Exposure =
accepted wagers not yet settled
```

Rules:

- Pending exposure is not included in weekly figure.
- Pending exposure is shown separately.
- Pending exposure rolls forward until settled.
- Pending exposure reduces available credit.
- Exposure reporting must include direct account exposure and downline exposure.

Reporting treatment:

- Player reports show own exposure.
- Agent reports show direct player exposure.
- Master reports show all downline exposure recursively.
- Super Master reports show platform exposure.

## 7. Agent Rollup

Agent Weekly Figure:

```text
Agent Weekly Figure =
sum of all direct player weekly figures
```

Agent Exposure:

```text
Agent Exposure =
sum of all direct player pending exposure
```

Views:

- Daily view: activity grouped by local business day.
- Weekly view: activity grouped by configured weekly cycle.
- Statement view: opening balance, weekly figure, deposits, withdrawals, commission, and closing balance.

Rules:

- Agents do not contain other Agents.
- Agents roll up direct Players only.
- Agent reports should not show parent Master financials.

## 8. Master Agent Rollup

Master Weekly Figure:

```text
Master Weekly Figure =
sum of all downline Agents and Master Agents
```

Master Exposure:

```text
Master Exposure =
sum of all downline exposure
```

Recursive rollup rules:

- Master Agents may contain Master Agents.
- Master Agents may contain Agents.
- Rollup must recursively traverse all descendants.
- Player figures roll up through Agent to every parent Master Agent.
- Historical statements should use the hierarchy snapshot effective for the statement period.

## 9. Super Master Rollup

Platform Weekly Figure:

```text
Platform Weekly Figure =
sum of entire hierarchy
```

Platform Exposure:

```text
Platform Exposure =
sum of all pending exposure
```

Rules:

- Super Master sees total network performance.
- Super Master rollups include all Masters, Agents, and Players.
- Super Master reporting is the platform-level operational view.

## 10. Commission Models

The platform should support multiple future commission models.

### Model A: Revenue Share

Concept:

```text
Commission =
net revenue × revenue share percentage
```

Used when the operator shares net revenue with downline partners.

### Model B: Percentage of Weekly Figure

Concept:

```text
Commission =
weekly figure × commission percentage
```

The sign convention must be finalized before implementation.

### Model C: Tiered Percentage

Concept:

```text
Commission =
weekly figure × tier percentage
```

Tier is selected by volume, revenue, player count, or other configured threshold.

### Model D: Flat Weekly Fee

Concept:

```text
Commission =
configured flat amount per weekly period
```

May apply to specific Agents or Masters regardless of performance.

### Model E: Hybrid

Concept:

```text
Commission =
revenue share component
+ tier component
+ flat fee component
+ adjustments
```

Hybrid models support complex commercial agreements.

No final commission model is selected in this design version.

## 11. Commission Inputs

Required inputs:

- weekly figure
- pending exposure
- carry balance
- commission percentage
- commission tier
- effective dates
- account hierarchy path
- market
- currency
- settlement period
- funding type
- manual adjustments

Source records:

- ledger transactions
- settlement records
- ticket lines
- account hierarchy snapshots
- commission assignment records

## 12. Commission Statements

Statement sections:

- Opening Balance
- Weekly Figure
- Pending Exposure
- Commission
- Deposits
- Withdrawals
- Closing Balance

### Player Statement

Shows:

- opening balance
- wins/losses
- adjustments
- freeplay wins
- pending exposure
- deposits/withdrawals when applicable
- closing balance

### Agent Statement

Shows:

- direct player weekly figures
- direct player pending exposure
- commission calculation
- deposits/withdrawals
- closing balance

### Master Statement

Shows:

- recursive downline weekly figures
- recursive pending exposure
- commission calculation
- downline summaries by Agent/Master
- deposits/withdrawals
- closing balance

## 13. Freeplay Treatment

Freeplay losses:

- no operational loss entry

Freeplay wins:

- create `freeplay_win` operational transaction

Commission calculations:

- should use operational ledger outputs
- should include `freeplay_win` according to configured model
- should exclude freeplay grants and freeplay wagers from weekly figure

## 14. Resettlement Impact

If settlement reversal occurs:

- commission inputs recalculate
- historical audit is retained
- commission adjustments are generated
- no silent overwrites occur

Rules:

- Original commission records remain.
- Reversal or adjustment commission records are created.
- Corrected commission records reference source resettlement records.
- Statements show adjustments transparently.

## 15. Audit Requirements

Audit required for:

- commission configuration changes
- commission percentage changes
- commission tier changes
- commission assignment changes
- commission recalculation
- commission adjustment
- commission payout
- statement regeneration

Audit records should include:

- actor
- old value
- new value
- reason code
- effective date
- affected account
- affected period

## 16. Future Tables

Conceptual tables only:

- `commission_plans`
- `commission_assignments`
- `commission_runs`
- `commission_records`
- `commission_adjustments`

### `commission_plans`

Defines available commission models, rates, tiers, and calculation rules.

### `commission_assignments`

Assigns commission plans to accounts with effective dates.

### `commission_runs`

Represents a commission calculation execution for a period.

### `commission_records`

Stores calculated commission output per account and period.

### `commission_adjustments`

Stores additive adjustments caused by corrections, overrides, or resettlement.

## 17. Open Questions

- What final commission model should be used for first production release?
- What is the commission payment frequency?
- Are minimum payout thresholds required?
- Should pending exposure affect commission eligibility or only reporting?
- Should weekly figure use settlement completion period or drawing period?
- Should freeplay wins be commissionable for every operator?
- Should commission rates be inherited downline or assigned independently per account?
