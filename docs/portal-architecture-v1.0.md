# Portal Architecture v1.0

## 1. Portal Principles

Portals must be:

- permission scoped
- hierarchy scoped
- market aware
- wallet aware
- audit aware
- responsive
- role-specific
- operationally safe

No portal should rely only on UI hiding. Backend authorization must enforce all access. Portal navigation may hide unavailable actions, but service/API authorization must remain authoritative.

## 2. Portal Types

Platform Operator Portal:

Used by:

- Super Admin
- Operations Admin
- Settlement Admin
- Risk Admin
- Compliance Admin
- Support Admin

Master Agent Portal:

Used by:

- Master Agent

Agent Portal:

Used by:

- Agent

Player Portal:

Used by:

- Player

## 3. Platform Operator Portal

Primary modules:

- Dashboard
- Markets
- Games
- Draws
- Results
- Settlement
- Resettlement
- Ledger
- Wallets
- Cashier
- Accounts
- Agents / Hierarchy
- Commissions
- Reports
- Risk
- Support Cases
- Audit
- Integrity
- Notifications
- Admin Users
- System Configuration

Module access must be permission-based.

## 4. Operator Dashboard

Show:

- draw status
- settlement status
- protection modes
- cashier status
- risk alerts
- integrity alerts
- pending overrides
- pending withdrawals
- failed jobs
- system health

The dashboard should prioritize operational issues requiring action.

## 5. Operations Admin Workflow

Can monitor:

- draws
- results
- settlements
- cashier activity
- alerts

Can act based on permissions:

- manual result entry
- settlement retry
- account freeze
- user support escalation

Operations Admin actions must be audited when they affect results, settlement, accounts, cashier operations, or protection modes.

## 6. Settlement Admin Workflow

Can monitor:

- settlement runs
- partially completed settlements
- failed ticket lines
- resettlement requests

Can act based on permissions:

- retry settlement
- request resettlement
- execute approved resettlement

Settlement Admins cannot bypass accounting period closure rules, override approval requirements, or dual-control requirements.

## 7. Risk Admin Workflow

Can monitor:

- large payouts
- abnormal betting
- linked account flags
- withdrawal holds
- risk cases

Can act:

- freeze account
- release risk hold
- review flagged accounts

Risk Admin actions that affect wagering, withdrawals, or account status must be audited.

## 8. Support Admin Workflow

Can view:

- player profile
- balances
- tickets
- transaction history
- statements

Can create:

- support cases
- dispute cases

Cannot:

- modify settlement
- modify result
- resettle
- directly alter financial outcomes unless specific adjustment permission exists

Support workflows should favor case creation and escalation over direct financial changes.

## 9. Compliance Admin Workflow

Can view:

- audit logs
- integrity results
- high-risk permission changes
- break-glass activity
- admin session history
- override approvals

Compliance Admin is mostly read-only unless permissions allow otherwise.

Compliance access should support investigation and export workflows.

## 10. Master Agent Portal

Modules:

- Dashboard
- Downline Masters
- Agents
- Players
- Statements
- Weekly Figures
- Commissions
- Pending Exposure
- Reports

Visibility:

- all descendants only

Cannot access:

- result correction
- settlement execution
- resettlement
- RNG configuration
- market configuration
- audit/integrity governance

Master Agent portal data must be recursively scoped to the downline.

## 11. Agent Portal

Modules:

- Dashboard
- Players
- Player Statements
- Weekly Figures
- Pending Exposure
- Reports
- Adjustments where permitted

Visibility:

- direct players only

Cannot access:

- platform governance
- result correction
- settlement
- resettlement
- RNG
- market configuration

Agent portal workflows should be optimized for player management, statements, and exposure review.

## 12. Player Portal

Separate UX models:

### A. Rapid Draw Product

- stacked game cards on mobile
- countdown timer
- visible draw ID
- No More Bets lockout
- Result Pending state
- one-click market selection
- sportsbook-style bet slip
- multiple lines per slip
- independent stake per line

Draw rules:

- 25-second draw cycle
- 5-second lockout
- Result Pending if unsettled

### B. Hot Spot / Keno Product

- 4-minute draw cycle
- number grid
- spot selection
- bullseye toggle
- quick picks
- countdown timer
- draw ID visible
- bet slip
- result animation
- Result Pending state

Player portal must be mobile-first and must treat backend cutoff enforcement as authoritative.

## 13. Player Wallet View

Show:

- cash balance
- credit balance
- freeplay balance
- pending wagers
- available credit

Actions:

- deposit if cash wallet enabled
- withdrawal request if cash wallet enabled
- view transaction history
- view ticket history

Wallet views must clearly separate cash, credit, and freeplay balances.

## 14. Bet Slip Model

Support:

- multiple selections per slip
- independent stake per line
- funding source selection
- potential payout display
- countdown visible
- lockout enforcement

Backend cutoff is always authoritative.

Bet slips should show whether a wager is funded by cash, credit, or freeplay.

## 15. Statements

Player:

- transactions
- tickets
- wins/losses
- deposits
- withdrawals
- adjustments

Agent:

- player summaries
- weekly figures
- exposure
- balances

Master:

- recursive summaries
- downline rollups
- commissions

Statements must reconcile to ledger, settlement, wallet, and commission records.

## 16. Portal Navigation

Navigation should be role-aware.

Menus should be generated from:

- role
- permissions
- hierarchy scope
- market configuration

Navigation must not be treated as authorization. Hidden menu items are only a user-experience layer.

## 17. Responsive Design

Player Portal:

- mobile first

Operator Portal:

- desktop first

Agent/Master Portal:

- responsive desktop/tablet first

Player wagering interactions must prioritize speed, clarity, countdown visibility, and lockout state.

## 18. Security Rules

Backend authorization must enforce:

- hierarchy visibility
- permission access
- platform governance restrictions
- wallet action restrictions
- cashier approval rights
- resettlement restrictions

Sensitive actions may require reauthentication, MFA confirmation, approval, or dual-control depending on policy.

## 19. Audit Requirements

Audit:

- high-risk page access
- financial adjustments
- withdrawals approvals
- result operations
- settlement operations
- resettlement operations
- permission changes

Audit records should include actor, target entity, timestamp, action, reason, old value/new value where applicable, and approval reference where applicable.

## 20. Future Portal Implementation

Recommended future phases:

- Operator Portal
- Agent Portal
- Master Portal
- Player Rapid Draw UI
- Player Hot Spot UI

Implementation should proceed after authentication, authorization, and core API boundaries are production-ready.

## 21. Open Questions

Future decisions:

- exact dashboard layout
- player design theme
- mobile app vs responsive web
- agent report layout
- master report layout
- support case UI
- cashier UI
- risk case UI
- whether portals share one shell or use separate applications
- whether player portal supports multiple brands from one account
