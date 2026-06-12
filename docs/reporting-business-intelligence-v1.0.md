# Reporting & Business Intelligence v1.0

## 1. Reporting Principles

Reports must be:

- permission scoped
- hierarchy scoped
- auditable
- reproducible
- exportable
- timezone aware
- market aware

Reports must be generated from authoritative domain records such as ledger transactions, settlement records, ticket lines, wallet balances, commission records, audit logs, and integrity verification outputs.

## 2. User Scopes

Reporting visibility:

Player:

- self only

Agent:

- direct players only

Master Agent:

- all downline accounts

Super Admin / Platform Operator:

- full platform subject to permissions

Every report must enforce hierarchy scope and permission scope before data is returned or exported.

## 3. Player Reports

Player reports include:

- player statement
- wallet balances
- cash wallet history
- credit wallet history
- freeplay wallet history
- ticket history
- pending tickets
- settled tickets
- wins/losses
- adjustments
- deposits
- withdrawals

Player-facing reports must be clear, reproducible, and aligned with wallet and ledger records.

## 4. Agent Reports

Agent reports include:

- player summary
- player weekly figures
- pending exposure
- credit balances
- cash balances
- transaction detail
- adjustment history
- settlement detail
- commission detail where applicable

Agent reports must include only direct players unless future policy explicitly expands scope.

## 5. Master Agent Reports

Master Agent reports include recursive rollups:

- downline agents
- downline masters
- player totals
- weekly figures
- exposure
- commissions
- balance summaries

Master Agent reports must use recursive hierarchy traversal and must not expose accounts outside the downline.

## 6. Platform Reports

Platform reports include:

- total handle
- total payouts
- GGR
- net win/loss
- active players
- active agents
- pending exposure
- settlement performance
- draw performance
- cashier activity
- risk alerts
- integrity alerts

Platform reports require platform operator permissions and must be auditable when exported.

## 7. Financial Reports

Financial reports include:

- ledger report
- wallet report
- cash balance report
- credit balance report
- freeplay report
- deposits report
- withdrawals report
- adjustments report
- zero balance report
- carry balance report

Gross accounting rules:

- `bet_stake` is negative
- `bet_win` is positive
- `freeplay_win` is positive
- deposits and withdrawals are excluded from weekly figure
- zero balance transactions are excluded from operational weekly figure

Financial reports must reconcile to ledger transactions and wallet summaries.

## 8. Settlement Reports

Settlement reports include:

- settlement run report
- settlement records
- failed settlement lines
- partially completed runs
- settlement duration
- draw-to-settlement time
- resettlement history
- reversal records

Settlement reports must support operational monitoring, reconciliation, and dispute review.

## 9. Commission Reports

Commission reports include:

- commission run report
- commission records
- agent commission detail
- master commission detail
- commission adjustments
- disputed commissions

Commission reports must be reproducible from commission records, ledger records, and hierarchy rollups.

## 10. Cashier Reports

Cashier reports include:

- deposit report
- withdrawal report
- pending withdrawals
- failed withdrawals
- manual reconciliations
- provider callback report
- provider settlement report

Cashier reports must distinguish provider-side status from platform wallet status.

## 11. Risk Reports

Risk reports include:

- large payout report
- abnormal betting report
- linked account report
- freeze report
- withdrawal hold report
- risk case report

Risk reports must support configurable thresholds and future fraud-detection signals.

## 12. Operations Reports

Operations reports include:

- missed draw report
- delayed result report
- settlement failure report
- protection mode report
- alert acknowledgement report
- worker health report

Operations reports must support incident review and SLA tracking.

## 13. Audit / Integrity Reports

Audit and integrity reports include:

- audit timeline
- override approval report
- high-risk permission report
- integrity verification report
- hash failure report
- break-glass account use report

These reports must preserve audit continuity and support investigation of high-risk administrative actions.

## 14. Timezone / Market Handling

Reports must use:

- market timezone
- accounting period timezone
- user display timezone where appropriate

Weekly reports must align to:

- market weekly reset configuration

Report filters and exports must clearly identify the timezone used for date boundaries.

## 15. Export Requirements

Future export formats:

- CSV
- XLSX
- PDF

Exports must respect:

- hierarchy scope
- permissions
- timezone
- filters

Export actions should be auditable. Exported reports should include generation timestamp, actor, filters, timezone, market, and scope metadata where appropriate.

## 16. Dashboard Requirements

Future dashboards:

- operations dashboard
- settlement dashboard
- financial dashboard
- agent dashboard
- risk dashboard
- integrity dashboard

Dashboards must use the same permission and hierarchy scoping rules as reports.

## 17. Performance Requirements

Reports over large datasets should support:

- date filters
- pagination
- background generation
- cached summaries
- materialized views later
- read replicas later

Long-running reports should not block settlement, draw generation, cashier operations, or ticket intake.

## 18. Data Consistency

Reports must reconcile with:

- ledger balances
- settlement records
- commission records
- wallet balances
- audit logs

Discrepancies between reports and authoritative domain records must trigger investigation before financial statements or exports are considered final.

## 19. Open Questions

Future decisions:

- exact report layouts
- export templates
- BI tool integration
- scheduled reports
- email delivery
- data warehouse need
- report retention policy
- report signing requirements
- which reports require approval before external distribution
