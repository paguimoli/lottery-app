# Notification Architecture v1.0

## 1. Notification Principles

Notifications must be:

- auditable
- permission aware
- severity aware
- market aware
- user preference aware
- retryable
- provider independent

Notification delivery must not contain sensitive secrets or bypass platform authorization rules. High-risk operational notifications must be delivered even when user preference settings would otherwise suppress lower-priority messages.

## 2. Notification Types

Notification categories:

- authentication
- security
- operations
- settlement
- draw
- result
- cashier
- risk
- support
- accounting
- commission
- audit
- integrity
- system

Each notification event should define category, severity, recipients, channels, template, market, and related entity metadata.

## 3. Severity Levels

Severity levels:

- info
- warning
- critical
- emergency

Info examples:

- weekly report generated
- commission run completed

Warning examples:

- single missed draw
- delayed result
- cashier callback delayed

Critical examples:

- settlement protection mode
- integrity failure
- repeated settlement failure
- cashier provider failure

Emergency examples:

- database unavailable
- RNG unavailable
- authentication outage
- major financial integrity breach

## 4. Channel Routing

Supported initial channels:

- in-app
- email
- SMS
- Telegram

Future channels:

- Slack
- Microsoft Teams
- WhatsApp
- web push

Default routing:

Info:

- in-app
- email optional

Warning:

- in-app
- email

Critical:

- in-app
- email
- Telegram
- SMS if configured

Emergency:

- in-app
- email
- Telegram
- SMS

Routing must respect market configuration, user preference rules, and emergency override rules.

## 5. Alert Escalation

Alert lifecycle:

Created -> Acknowledged -> Resolved.

Escalation rules:

5 minutes unacknowledged:

- escalate to Super Admin

15 minutes unacknowledged:

- emergency escalation
- SMS/Telegram/email to emergency recipients

Escalation events must be auditable and include timestamps, recipients, alert id, and triggering condition.

## 6. Notification Recipients

Recipient rules by event type:

Draw alerts:

- Super Admin
- Operations Admin
- Settlement Admin
- Risk Admin

Settlement alerts:

- Super Admin
- Operations Admin
- Settlement Admin
- Risk Admin

Cashier alerts:

- Super Admin
- Operations Admin
- Risk Admin
- Cashier-permission users

Risk alerts:

- Super Admin
- Risk Admin
- Operations Admin

Integrity alerts:

- Super Admin
- Risk Admin
- Compliance Admin

Authentication security alerts:

- affected user
- Super Admin for platform operator incidents

Recipient resolution must be permission aware and must not notify unauthorized users about restricted operational details.

## 7. Notification Provider Abstraction

Provider adapter layer:

Examples:

- Email Provider
- SMS Provider
- Telegram Provider
- Slack Provider

Common interface:

- `sendNotification()`
- `sendBulkNotification()`
- `getDeliveryStatus()`

Provider adapters must normalize:

- provider request format
- provider response format
- delivery status
- error codes
- retry eligibility

Provider-specific code must not leak into domain workflows.

## 8. Templates

Template system fields:

- template code
- channel
- locale
- subject
- body
- variables
- severity
- market

Template examples:

- `SETTLEMENT_PROTECTION_MODE`
- `DRAW_DELAYED`
- `PASSWORD_RESET`
- `MFA_ENABLED`
- `WITHDRAWAL_APPROVED`
- `WITHDRAWAL_REQUIRES_REVIEW`
- `INTEGRITY_FAILURE`

Templates must support localization and market-specific overrides.

## 9. User Preferences

Hierarchy participants may configure:

- email notification preferences
- SMS notification preferences
- Telegram preferences where supported

Platform operators:

- cannot disable emergency/critical operational notifications

User preference rules must not suppress required security, account recovery, MFA, or emergency operational notifications.

## 10. Market Configuration

Notifications may vary by market:

- enabled channels
- default language
- SMS provider
- email provider
- Telegram bot
- escalation recipients

Market configuration should define default routing, provider selection, localization, and escalation recipients.

## 11. Retry Strategy

Retry rules:

- transient provider failure
- exponential backoff
- maximum retry count
- dead-letter / failed notification queue

Emergency notifications should retry more aggressively.

Retry strategy should distinguish:

- transient provider error
- permanent provider rejection
- invalid recipient
- provider timeout
- rate limit

Failed notifications should be visible to operations staff and included in reporting.

## 12. Delivery Tracking

Track delivery states:

- created
- queued
- sent
- delivered
- failed
- acknowledged
- resolved

Delivery records should include:

- notification event id
- recipient id
- channel
- provider
- provider reference
- attempt count
- last error
- timestamps

## 13. Audit Requirements

Audit:

- notification created
- notification sent
- notification failed
- alert acknowledged
- alert resolved
- escalation triggered
- emergency notification sent

Audit records should capture actor, recipient, event type, severity, channel, provider, related entity, and timestamps.

## 14. Security Requirements

Never send:

- passwords
- full payment credentials
- full PII
- API secrets
- MFA secrets

Sensitive notifications should use limited information and link users back to a secure portal.

Examples:

- password reset notifications should contain a time-limited link, not a password
- MFA notifications must not expose MFA secret values
- cashier notifications should avoid full payment account details

## 15. Future Notification Tables

Conceptual tables only:

- notification_templates
- notification_events
- notification_deliveries
- notification_preferences
- notification_escalations

No migrations are created in this phase.

Future tables should support market, locale, provider, retry state, audit linkage, and delivery metadata.

## 16. Open Questions

Future decisions:

- first email provider
- first SMS provider
- Telegram bot setup
- WhatsApp support
- localization rules
- user opt-out rules
- notification retention
- emergency recipient configuration
- retry count and backoff defaults
- whether delivery events require integrity hashing
