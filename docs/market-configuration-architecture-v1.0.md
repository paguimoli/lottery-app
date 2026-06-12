# Market Configuration Architecture v1.0

## 1. Market Principles

Markets define operational defaults.

Players, agents, games, cashier rules, reports, and accounting inherit market settings unless explicitly overridden by account, game, wager, or operator configuration.

Market configuration is not a regulatory/geofencing layer. It is an operational localization and defaulting layer for product behavior, accounting, reporting, risk, notifications, and cashier operations.

## 2. Market Identity

Market identity fields:

- market code
- market name
- status
- brand name
- default language
- default currency
- default timezone

Time zone rules:

- Use IANA time zones.
- Do not use ambiguous local labels such as `EST` or `PST`.
- Store canonical values such as `America/Costa_Rica`, `America/New_York`, or `Asia/Ho_Chi_Minh`.

Market status should support active, inactive, and archived states in future implementation.

## 3. Localization

Localization settings:

- language
- date format
- time format
- number format
- currency format

Localization affects:

- player display
- agent display
- ticket display
- statements
- reports
- exports
- notifications

Localization should be market-defaulted but may be overridden by account preference where supported.

## 4. Accounting Configuration

Accounting settings:

- weekly reset day
- weekly reset time
- weekly reset timezone
- accounting period rules
- zero balance / carry defaults

Weekly reset timezone must use an IANA time zone. Accounting periods must be derived from market configuration and must be stable for historical reporting.

Zero balance / carry defaults:

- zero balance accounts close automatically through zero balance credit/debit transactions
- carry accounts roll balances forward until manual deposit/withdrawal or adjustment

Closed accounting periods must remain financially immutable.

## 5. Wallet Configuration

Wallet settings:

- cash enabled
- credit enabled
- freeplay enabled
- default wallet creation rules
- default credit rules

Default wallet creation:

- player accounts may receive cash wallet
- player accounts may receive credit wallet
- player accounts may receive freeplay wallet

Default credit rules may include:

- default credit limit
- maximum credit limit
- available credit calculation
- exposure handling

Settlement must preserve originating wallet type.

## 6. Cashier Configuration

Cashier settings:

- enabled cashier providers
- deposit rules
- withdrawal rules
- withdrawal approval requirements
- withdrawal thresholds
- reconciliation rules

Deposit rules:

- approved provider callback may create automatic cash wallet credit
- failed deposits require provider reconciliation

Withdrawal rules:

- all withdrawals require approval
- failed withdrawals require operator review
- withdrawal thresholds may trigger additional approval or risk review

Cashier configuration must remain provider-agnostic so future cashier adapters can support multiple providers.

## 7. MFA / Security Configuration

Hierarchy participant MFA policy:

- player MFA optional/required
- agent MFA optional/required
- master MFA optional/required

Platform operator MFA remains mandatory globally and is not weakened by market configuration.

Market security settings may define:

- MFA requirement for players
- MFA requirement for agents
- MFA requirement for master agents
- trusted device policy
- session duration defaults
- account lockout thresholds

## 8. Notification Configuration

Notification settings:

- email enabled
- SMS enabled
- Telegram enabled
- future Slack/Teams support
- alert routing by severity

Alert routing should support:

- INFO
- WARNING
- CRITICAL
- EMERGENCY

Notification providers may vary by market. Provider credentials must be managed through secret references, not raw database values.

## 9. Game Availability

Game availability settings:

- available games per market
- game status per market
- draw schedule overrides
- result source mode per game/market
- RNG provider per game/market

Markets may enable or disable games independently from global game definitions.

Market game configuration may override:

- draw interval
- draw schedule
- draw ID prefix
- result source mode
- RNG provider
- game display name

## 10. Wager Availability

Wager availability settings:

- enabled wager types per market
- enabled wager options per market
- min/max stake defaults
- payout/paytable assignment

Markets may restrict wager options without changing the global wager type definition.

Paytable assignment should be market-aware where required by product configuration.

## 11. Agent Hierarchy Defaults

Hierarchy default settings:

- default account creation rules
- player prefix rules
- minimum account number digits
- default credit limits
- default visibility rules

Market defaults may be applied when creating:

- master agents
- agents
- players

Visibility rules must still respect the global hierarchy authorization engine:

- player sees self
- agent sees direct players
- master agent sees downline
- platform operator sees platform subject to permissions

## 12. Reporting Configuration

Reporting settings:

- reporting timezone
- accounting timezone
- export formats
- scheduled reports
- market-level report access defaults

Reports should align with:

- market timezone for operational activity
- accounting timezone for weekly close and statements
- user display timezone where appropriate

Export formats may include:

- CSV
- XLSX
- PDF

Scheduled reports must respect market scope, hierarchy scope, permissions, and timezone boundaries.

## 13. Risk Configuration

Risk settings:

- large payout thresholds
- abnormal betting thresholds
- withdrawal hold thresholds
- linked account detection settings
- account freeze defaults

Risk thresholds may vary by market based on operational tolerance, product type, cashier provider, and player behavior profile.

Risk configuration may trigger:

- risk review queue creation
- withdrawal hold
- wagering freeze
- account review
- operator alert

## 14. Operations Configuration

Operations settings:

- draw delay thresholds
- settlement SLA thresholds
- protection mode thresholds
- alert escalation rules

Examples:

- Rapid Draw result/settlement alert threshold
- Hot Spot delayed result threshold
- missed draw threshold
- consecutive settlement failure threshold
- cashier failure threshold
- integrity failure threshold

Protection mode rules may disable wagering, pause withdrawals, generate critical alerts, or require operator review.

## 15. Override Rules

Configuration levels:

- global only
- market-configurable
- account-configurable
- game-configurable

Global only:

- platform operator MFA requirement
- governance permission restrictions
- immutable ledger rules
- closed accounting period immutability

Market-configurable:

- language
- currency
- timezone
- cashier providers
- notification providers
- hierarchy participant MFA policy
- reporting defaults
- risk thresholds

Account-configurable:

- language preference
- credit limit
- wallet availability where allowed
- account-level risk restrictions

Game-configurable:

- draw schedule
- result source mode
- RNG provider
- wager availability
- paytable assignment

Override precedence should be explicit in future implementation:

global baseline -> market default -> game/account override.

## 16. Future Market Tables

Conceptual tables only:

- markets
- market_wallet_config
- market_cashier_config
- market_security_config
- market_notification_config
- market_game_config
- market_wager_config
- market_risk_config
- market_reporting_config

No migrations are created in this phase.

These tables should support effective dates and audit history where market configuration changes affect money, settlement, reporting, cashier behavior, or player access.

## 17. Open Questions

Future decisions:

- first market code/name
- default currency
- default timezone
- initial languages
- initial cashier provider
- initial notification providers
- market branding model
- whether game availability is configured globally first or market-first
- whether market-level risk thresholds require approval workflow
- whether scheduled reports are configured at market or operator level
