# Implementation Roadmap v1.0

## 1. Roadmap Principles

Implementation order must reduce financial, operational, and security risk.

Principles:

- authentication before portals
- authorization before reports
- market configuration before player onboarding
- wallet persistence before cashier integration
- cashier foundation before live deposits/withdrawals
- notifications before operations escalation
- operator portal before player portal
- player portal after financial controls are stable

The platform should continue to separate design, domain logic, persistence, APIs, and UI so each phase can be validated independently.

## 2. Phase 9.0 Authentication Implementation

Scope:

- user identity model
- platform operator accounts
- hierarchy participant login accounts
- Argon2id password hashing
- MFA
- sessions
- password reset
- account lockout
- break-glass accounts

Outcome:

- authenticated identities exist for platform operators and hierarchy participants
- identity classes remain separate
- sensitive authentication events are auditable

## 3. Phase 10.0 Authorization Integration

Scope:

- enforce hierarchy authorization in controllers
- enforce platform-only permissions
- role/permission assignment rules
- menu generation by permissions
- reporting scope enforcement

Outcome:

- backend authorization gates sensitive actions
- hierarchy participants cannot receive platform governance powers
- reports and future portals can rely on scope-aware authorization

## 4. Phase 11.0 Market Configuration Implementation

Scope:

- market settings
- timezone
- language
- currency
- weekly close configuration
- market-level MFA policy
- market-level cashier rules
- game availability by market

Outcome:

- market defaults can drive onboarding, reporting, accounting, cashier behavior, notifications, and product availability

## 5. Phase 12.0 Wallet Persistence Implementation

Scope:

- cash wallet
- credit wallet
- freeplay wallet
- wallet balances
- wallet status
- funding source enforcement
- wallet-aware statements

Outcome:

- wallet records are persisted
- wallet status gates wagers and cashier operations
- statements can separate cash, credit, and freeplay activity

## 6. Phase 13.0 Cashier Foundation

Scope:

- cashier provider model
- cashier transaction model
- deposit lifecycle
- withdrawal lifecycle
- approval workflow
- callback handling
- reconciliation exception queue

Outcome:

- cashier integration can be implemented without provider-specific logic leaking into wallet, ledger, or settlement domains
- deposits and withdrawals remain auditable and reconcilable

## 7. Phase 14.0 Notification Foundation

Scope:

- notification templates
- notification events
- email/SMS/Telegram adapters
- alert escalation
- delivery tracking
- notification preferences

Outcome:

- operations alerts can route by severity, recipient, permission, market, and channel
- escalation workflows can support production operations

## 8. Phase 15.0 Operator Portal

Scope:

- operations dashboard
- settlement dashboard
- risk dashboard
- cashier dashboard
- support cases
- audit/integrity views
- admin user management

Outcome:

- platform operators can manage production operations through permission-scoped workflows
- high-risk actions are backed by authorization and audit controls

## 9. Phase 16.0 Agent / Master Portals

Scope:

- hierarchy dashboard
- player management
- statements
- weekly figures
- commissions
- pending exposure
- reports

Outcome:

- agents and master agents can view scoped business data without platform governance access
- hierarchy reporting uses authorization scope

## 10. Phase 17.0 Player Portal

Scope:

- rapid draw UI
- Hot Spot/Keno UI
- wallet view
- cashier deposit/withdrawal
- ticket history
- statements

Outcome:

- players can wager and manage wallet/cashier workflows after financial, authorization, and operational controls are stable

## 11. Phase 18.0 Infrastructure Implementation

Scope:

- Docker
- environment configuration
- staging/production separation
- managed database configuration
- Redis
- monitoring/logging
- backups/PITR

Outcome:

- production infrastructure can support deployment, monitoring, backup, recovery, and operational hardening requirements

## 12. Phase 19.0 Production Security Enhancements

Scope:

- public/private signing
- key rotation
- HSM readiness
- external notarization
- certification preparation

Outcome:

- integrity hashing can be extended into cryptographic signing and production-grade attestation after schema stabilization

## 13. Dependencies

Major dependencies:

- portals require authentication and authorization
- cashier requires wallet persistence
- reporting requires authorization scope
- notifications support operations
- infrastructure required before production
- signing after schema stabilization

Detailed dependency notes:

- Authentication must precede portal implementation because portals require real identity/session context.
- Authorization integration must precede reporting and portals because scope cannot be safely enforced by UI alone.
- Market configuration must precede player onboarding because language, timezone, currency, wallet defaults, cashier rules, and product availability are market-derived.
- Wallet persistence must precede cashier integration because deposits and withdrawals must affect durable wallet records.
- Cashier foundation must precede live payment processing because provider callbacks, approvals, idempotency, and reconciliation must exist first.
- Notifications must precede operational escalation so critical incidents can be routed and acknowledged.
- Operator portal should precede player portal so production support, risk, settlement, cashier, and audit controls exist before live wagering.
- Public/private signing should occur only after schema and canonical payload formats stabilize.

## 14. Open Questions

Future decisions:

- auth provider choice
- hosting provider
- first cashier provider
- notification providers
- portal implementation order
- first market configuration
- whether operator and hierarchy portals share a frontend shell
- whether Redis is required before or after first staging deployment
- whether BI/reporting should use app-native reports first or a warehouse-first approach
