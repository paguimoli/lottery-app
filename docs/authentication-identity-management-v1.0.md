# Authentication & Identity Management v1.0

## 1. Identity Model

The platform has two identity classes.

Platform Operators:

- Super Admin
- Operations Admin
- Settlement Admin
- Risk Admin
- Compliance Admin
- Support Admin

Hierarchy Participants:

- Master Agent
- Agent
- Player

Principle:

Platform operator identities and hierarchy participant identities must remain separate. Hierarchy participants are financially interested parties and must not receive platform governance powers through identity configuration.

## 2. Login Identifier

Supported login identifiers:

- username
- email, if email login is enabled

Rules:

- login identity must be globally unique
- no duplicate usernames
- no duplicate emails if email login is enabled
- username and email changes must be audited

Global uniqueness prevents ambiguity across support workflows, PAM integrations, statements, audit logs, settlement review, and account recovery.

## 3. Password Security

Rules:

- never store passwords
- store password hashes only
- use Argon2id
- use a unique salt per password
- no reversible encryption for passwords

Minimum password length:

- initial recommendation: 12 characters
- final value to be confirmed before implementation

Password reset flow:

- user requests reset
- system creates time-limited reset token
- reset token is hashed before storage
- user completes password reset
- old reset token is invalidated
- event is audited

Password change flow:

- authenticated user provides current password
- new password is validated
- new password is hashed with Argon2id
- active sessions may be invalidated by policy
- event is audited

Password history policy:

- placeholder for future policy
- should prevent immediate reuse of recent passwords if required by operator policy

## 4. MFA Policy

Mandatory MFA:

- Super Admin
- Operations Admin
- Settlement Admin
- Risk Admin
- Compliance Admin

Optional MFA:

- Master Agent
- Agent
- Player

Future support:

- market-level MFA policies
- operator-level MFA policies
- risk-based MFA prompts

MFA states:

- disabled
- optional
- required
- pending_setup
- enabled

MFA recovery must be audited and may require administrative approval for platform operators.

## 5. Session Management

Platform Operators:

- single active session only
- shorter session duration
- session audit required
- idle timeout required

Hierarchy Participants:

- configurable session policy
- potentially longer sessions
- device/session controls determined by market or operator policy

Track:

- login time
- logout time
- IP
- device
- browser
- approximate location

Session lifecycle events must be auditable.

## 6. Reauthentication Requirements

Require password plus MFA reauthentication for:

- result correction
- resettlement approval
- large manual adjustment
- permission change
- commission recalculation
- withdrawal approval above threshold

Reauthentication should be time-boxed. A successful sensitive-action reauth should not grant indefinite access to other sensitive actions.

## 7. Account Lockout

Lockout rules:

- track failed login attempts
- configurable lockout threshold
- temporary lockout after threshold is reached
- high-risk repeated failure alert
- admin unlock procedure required for platform operator lockouts

Lockout policy must balance security with operational continuity. Repeated failures against high-risk accounts should generate alerts.

## 8. Password Reset

Password reset requirements:

- reset token must be hashed
- reset token expires
- reset request audited
- successful reset audited
- failed reset attempt audited when meaningful
- platform operator password reset may require admin approval

Reset tokens must be single-use. Expired or consumed reset tokens must not be reusable.

## 9. Forced Security Actions

Authorized platform operators can:

- terminate active session
- terminate all sessions
- force password reset
- require MFA re-enrollment
- disable account pending review

Forced security actions must be permission-controlled and audited.

## 10. Break-Glass Accounts

Break-glass policy:

- maintain 2 emergency accounts
- store credentials separately from normal operator credentials
- use only for MFA failure, admin lockout, or disaster recovery
- every use creates an emergency audit event
- post-use review required
- rotate credentials after use

Break-glass accounts must not be used for normal administration.

## 11. Dormant Account Handling

Platform operator account inactive for 90 days:

- disable pending review
- do not delete

Hierarchy participants:

- configurable by market/operator policy

Dormant account handling must preserve audit history and historical references.

## 12. Identity Audit Events

Audit events:

- login success
- login failure
- logout
- password reset requested
- password reset completed
- MFA enabled
- MFA disabled
- MFA failed
- session terminated
- account locked
- account unlocked
- break-glass account used

Audit records should include actor, target account, timestamp, IP address, device/browser metadata where available, and reason or metadata for administrative actions.

## 13. Sensitive Data Handling

Password:

- hash only

Session tokens:

- hash where applicable

Password reset tokens:

- hash only

MFA secrets:

- encrypted

PII:

- encrypt where required

API keys / provider secrets:

- encrypted or secret-reference only

Encryption keys must live outside the normal application database.

## 14. Authentication Provider Strategy

Options:

- custom auth
- Supabase Auth
- external provider

Recommendation for first implementation:

Use managed authentication where practical, but keep platform authorization and RBAC inside the application domain.

Rationale:

- managed authentication reduces password, session, and MFA implementation risk
- platform authorization rules are domain-specific and must remain under platform control
- hierarchy authorization and platform governance separation should not be outsourced to a generic auth provider

## 15. Open Questions

Unresolved decisions:

- final auth provider
- password length policy
- MFA app support
- session timeout values
- trusted device policy
- market-level MFA enforcement
- whether hierarchy participants can use email login or username-only login
- break-glass credential storage process
- platform operator password reset approval workflow
