# Database Constraints & Audit Architecture v1.0

## 1. Purpose

This document defines the exact production database protections required before writing migrations for the Lottery/Keno platform.

It covers:

- unique constraints
- foreign keys
- check constraints
- append-only protections
- audit requirements
- override approval requirements
- anti-manipulation rules
- hash and integrity targets

This is documentation only. It does not create migrations or modify Supabase tables.

## 2. Core Rule

Application validation is not enough.

Critical platform rules must be enforced at the database layer through constraints, foreign keys, triggers, stored procedures, restricted permissions, append-only policies, and audit records.

## 3. Accounts

### Required Constraints

Table: `accounts`

- `username` must be globally unique, case-insensitive.
- `account_type` must be one of:
  - `super_master`
  - `master_agent`
  - `agent`
  - `player`
- `parent_id` must reference `accounts.id` when present.
- `parent_id` cannot equal `id`.
- Circular hierarchy is not allowed.
- `super_master` must have `parent_id = null`.
- `master_agent` parent may be `super_master` or `master_agent`.
- `agent` parent must be `master_agent`.
- `player` parent must be `agent`.
- `player` cannot have child accounts.
- `credit_limit`, `allocated_credit`, and `current_exposure` must be non-negative.
- `status` must be a valid account status.

### Database Enforcement Notes

- Parent-type rules require triggers or controlled write functions because they depend on the parent row.
- Circular hierarchy prevention requires a recursive check.
- Deleting accounts with children should be blocked. Production should prefer deactivation over hard delete.

### Audit Required

Audit logs are required for:

- account create
- account update
- account status change
- account move/reparent
- account delete/deactivate
- credit limit changes
- market changes
- currency changes

### Override Required

Override approval should be considered for:

- moving accounts with active downline exposure
- reducing credit limits below current exposure
- deactivating accounts with open tickets

## 4. Markets

### Required Constraints

Table: `markets`

- `code` must be unique.
- `name` is required.
- `language` is required.
- `currency` is required.
- `time_zone` is required.
- `time_zone` must be an IANA time zone.
- `weekly_reset_day` must be valid, for example `monday` through `sunday`.
- `weekly_reset_time` must be valid local time.
- `weekly_reset_time_zone` must be an IANA time zone.
- `status` or `active` must be valid.

### Audit Required

Audit logs are required for:

- market create
- market update
- market deactivate
- weekly reset day changes
- weekly reset time changes
- weekly reset time zone changes
- currency changes

## 5. Games

### Required Constraints

Table: `games`

- `external_id` must be unique.
- `game_family` must be valid, for example `lottery` or `keno`.
- `game_type` must be valid for the selected `game_family`.
- Keno games must have `requires_paytable = true`.
- Keno games must have `draw_interval_seconds > 0`.
- Keno games must have non-empty `draw_id_prefix`.
- Keno games must have valid number pool min/max.
- Keno games must have valid `numbers_drawn`.
- Keno games must have valid spot levels.
- Lottery games must have lottery-specific fields, including main count and main range.
- Lottery games may require bonus fields depending on game type.
- Payout multiplier is not required for Keno.
- Payout multiplier must remain valid for non-Keno lottery products that use multiplier-based payout logic.

### Audit Required

Audit logs are required for:

- game create
- game update
- game archive
- draw schedule config change
- recurring Keno draw config change
- result source mode change
- RNG provider change
- paytable requirement changes

### Override Required

Override approval should be required for:

- changing game rules after drawings or tickets exist
- changing RNG provider on an active game
- changing result source mode on an active game

## 6. Drawings / Results

### Required Constraints

Tables:

- `drawings`
- `drawing_results`
- `keno_draw_metrics`

Drawings:

- Draw code must be unique per game.
- `game_id` must reference `games.id`.
- Drawing cutoff must be before draw time.
- Ticket acceptance must be blocked after cutoff.
- Draw status must be valid.
- Drawings with accepted tickets cannot be hard deleted.

Results:

- `drawing_id` must reference `drawings.id`.
- Official posted result rows are immutable.
- Direct edits after official posting are blocked.
- Corrections must create a new correction result row.
- Result correction rows must reference the prior official result.
- Bullseye number must be one of winning numbers for bullseye games.
- Keno result must contain expected draw count.
- Winning numbers must be valid for the game number pool.
- Duplicate active official results for a drawing are not allowed.

Keno metrics:

- `drawing_id` must reference `drawings.id`.
- Metrics must correspond to a posted official result.
- One active metrics row should exist per active official result version.

### Audit Required

Audit logs are required for:

- drawing create
- drawing update
- drawing void
- result post
- result correction
- result void
- Keno metrics generation

### Override Required

Override approval is required for:

- result correction
- drawing void after tickets accepted
- manual correction of generated draw metrics

## 7. Wagers / Pay Tables

### Required Constraints

Tables:

- `wager_types`
- `wager_options`
- `pay_tables`
- `pay_table_rows`

Wager types:

- `game_id` must reference `games.id`.
- Wager type code must be unique per game.
- Settlement method must be valid.
- Required metric fields must be present for metric-based methods.

Wager options:

- `wager_type_id` must reference `wager_types.id`.
- Wager option code must be unique per wager type.
- Wager option must belong to its wager type.

Pay tables:

- `game_id` must reference `games.id`.
- `wager_type_id` must reference `wager_types.id`.
- Only one active paytable may exist for the same game, wager type, and effective period.
- Effective date must be valid.
- Expiration date, if present, must be after effective date.

Pay table rows:

- `pay_table_id` must reference `pay_tables.id`.
- Spot count and hit count must be valid for the game.
- Payout must be greater than or equal to zero.
- Maximum payout must be greater than or equal to zero when present.
- Bullseye-specific rows must be valid only for games that support Bullseye.

### Audit Required

Audit logs are required for:

- wager type create
- wager type update
- wager type delete/deactivate
- wager option create
- wager option update
- wager option delete/deactivate
- paytable create
- paytable update
- paytable activate
- paytable deactivate
- paytable row changes

### Override Required

Override approval is required for:

- paytable change after tickets exist for affected game/draw
- paytable deactivation while active drawings exist
- wager rule changes after tickets exist

## 8. Tickets

### Required Constraints

Tables:

- `tickets`
- `ticket_lines`

Tickets:

- `ticket_number` must be globally unique.
- Ticket acceptance idempotency key must be unique.
- `account_id` must reference `accounts.id`.
- `game_id` must reference `games.id`.
- `drawing_id` must reference `drawings.id`.
- Ticket must have at least one line.
- Accepted tickets are immutable.
- Ticket cannot be accepted after cutoff.
- Funding type must be valid.
- Freeplay ticket funding must have available freeplay balance.
- Ticket status must be valid.

Ticket lines:

- `ticket_id` must reference `tickets.id`.
- `wager_type_id` must reference `wager_types.id`.
- `wager_option_id` must reference `wager_options.id` when present.
- Stake must be greater than zero.
- Potential payout must be greater than or equal to zero.
- Wager type must belong to the ticket game.
- Wager option must belong to the wager type.
- Selected numbers must be valid for the game and wager type.

### Audit Required

Audit logs are required for:

- ticket create
- ticket accept
- ticket cancel
- ticket void
- ticket rejection

### Override Required

Override approval is required for:

- void accepted ticket
- manual ticket cancellation after cutoff
- ticket correction attempt after acceptance

## 9. RNG / PRNG Result Sources

### Required Constraints

Tables:

- `rng_providers`
- `rng_requests`
- `rng_results`

RNG providers:

- Provider type must be valid:
  - `internal`
  - `third_party`
  - `official_feed`
  - `manual`
- Provider status must be valid:
  - `active`
  - `inactive`
  - `suspended`
- Provider name is required.
- Third-party RNG providers require endpoint URL.
- Official feed providers require endpoint URL or feed reference.
- Manual providers do not require endpoint URL.
- Raw API keys must never be stored in normal database fields.
- Only API key references or secret references may be stored.

RNG requests:

- `provider_id` must reference `rng_providers.id`.
- `game_id` must reference `games.id`.
- `drawing_id` must reference `drawings.id`.
- Request status must be valid:
  - `pending`
  - `completed`
  - `failed`
  - `cancelled`
- Idempotency key is required.
- Idempotency key must be unique for the intended provider/game/drawing execution.
- Raw request and raw response must not contain raw API secrets.

RNG results:

- `provider_id` must reference `rng_providers.id`.
- `request_id` must reference `rng_requests.id`.
- `game_id` must reference `games.id`.
- `drawing_id` must reference `drawings.id`.
- Winning numbers are required.
- Winning numbers must be valid for the game.
- Bullseye number, when present, must be one of winning numbers.
- Result hash is required once integrity hashing is enabled.

### Audit Required

Audit logs are required for:

- RNG provider create
- RNG provider update
- RNG provider suspend
- RNG provider deactivate
- RNG request create
- RNG request complete
- RNG request fail
- RNG result create
- RNG result void/supersede

### Override Required

Override approval is required for:

- changing RNG provider on an active game
- suspending active RNG provider with open drawings
- manually superseding an RNG result
- switching a game from internal PRNG or external RNG service to manual result entry

### Anti-Manipulation Rules

- Internal PRNG, external RNG service, official feed, and manual entry are supported result-source modes.
- RNG requests must be idempotent.
- RNG results must be auditable.
- Official results become immutable once posted.
- Manual result entry remains a controlled result source and must be audited.
- Direct writes to posted official results are blocked.

### Integrity Targets

Reserved fields where applicable:

- `record_hash`
- `previous_hash`
- `signature`
- `signature_key_id`
- `signature_version`
- `signed_at`

Public/private signing remains Phase 4.8 after schemas and canonical payload formats stabilize.

## 10. Financial Ledger

### Required Constraints

Table: `ledger_transactions`

- Ledger transactions are append-only.
- No update.
- No delete.
- Amount cannot be zero.
- Category must be valid:
  - `accounting`
  - `operational`
  - `freeplay`
- Transaction type must be valid for category.
- Reversal must reference original transaction.
- Reversal amount must oppose original amount.
- No reversal of reversal unless explicitly allowed by controlled override workflow.
- `account_id` must reference `accounts.id`.
- Currency must be valid.

### Category / Type Rules

Accounting examples:

- `deposit`
- `withdrawal`
- `zero_balance_credit`
- `zero_balance_debit`
- `transfer_in`
- `transfer_out`
- `manual_adjustment`

Operational examples:

- `win`
- `loss`
- `credit_adjustment`
- `debit_adjustment`
- `freeplay_win`

Freeplay examples:

- `freeplay_grant`
- `freeplay_wager`
- `freeplay_expiration`
- `freeplay_adjustment`
- `freeplay_reversal`

### Audit Required

Audit logs are required for:

- every ledger transaction
- every reversal
- every manual adjustment
- every zero balance correction

### Override Required

Override approval is required for:

- manual adjustment
- reversal
- zero balance correction

## 11. Settlement

### Required Constraints

Tables:

- `settlement_runs`
- `settlement_records`

Settlement runs:

- One completed settlement run per drawing.
- `drawing_id` must reference `drawings.id`.
- `game_id` must reference `games.id`.
- Status must be valid.
- Completed settlement run cannot be edited directly.
- Resettlement requires controlled override authorization.

Settlement records:

- `settlement_run_id` must reference `settlement_runs.id`.
- `ticket_id` must reference `tickets.id`.
- `ticket_line_id` must reference `ticket_lines.id`.
- Settlement record must belong to the referenced ticket line.
- Settlement version must be greater than or equal to 1.
- Reversal record must reference original record.
- Payout must be greater than or equal to zero.
- Net amount can be positive, negative, or zero.
- Ledger transaction linkage must reference `ledger_transactions.id` when present.

### Audit Required

Audit logs are required for:

- settlement run creation
- settlement completion
- settlement failure
- settlement reversal
- resettlement

### Override Required

Override approval is required for:

- resettlement
- reversal of completed settlement

## 12. Admin Access

### Required Constraints

Tables:

- `admin_users`
- `admin_roles`
- `admin_permissions`
- `admin_user_roles`

Constraints:

- Admin email must be unique, case-insensitive.
- Admin email must be valid format.
- Roles cannot be deleted if assigned.
- Sensitive permissions require explicit assignment.
- `admin_user_roles.admin_user_id` must reference `admin_users.id`.
- `admin_user_roles.admin_role_id` must reference `admin_roles.id`.
- Permission codes must be unique.

### Audit Required

Audit logs are required for:

- admin user create
- admin user update
- admin user suspend
- admin user delete/deactivate
- role create
- role update
- role delete/deactivate
- permission assignment changes

### Override Required

Override approval is required for:

- granting super admin
- granting `settlement.resettle`
- granting `wallets.adjust`

## 13. Audit Logs

### Table

- `audit_logs`

### Required Fields

- `id`
- `entity_type`
- `entity_id`
- `action`
- `actor_admin_id`
- `old_value`
- `new_value`
- `reason_code`
- `approval_admin_id`
- `ip_address`
- `user_agent`
- `created_at`
- `record_hash`
- `previous_hash`

### Required Constraints

- Audit logs are append-only.
- No update.
- No delete.
- `entity_type` is required.
- `entity_id` is required.
- `action` is required.
- `actor_admin_id` should reference `admin_users.id` when available.
- `created_at` is required.
- `record_hash` is required once integrity hashing is enabled.
- `previous_hash` is required for hash-chained audit streams once integrity hashing is enabled.

## 14. Override Approvals

### Table

- `override_approvals`

### Required Fields

- `id`
- `action_type`
- `entity_type`
- `entity_id`
- `requested_by`
- `approved_by`
- `reason_code`
- `status`
- `created_at`
- `approved_at`

### Actions Requiring Override

- result correction
- drawing void after accepted tickets
- accepted ticket void
- settlement resettlement
- ledger manual adjustment
- ledger reversal
- RNG result supersede
- RNG provider change on active game
- sensitive permission assignment

### Required Constraints

- `requested_by` must reference an admin user.
- `approved_by` must reference an admin user when status is approved.
- Requester and approver should be different for high-risk actions.
- Reason code is required.
- Status must be valid.
- Approval records are append-only after approval.

## 15. Integrity Targets

### Entities Requiring Hash Fields

- accepted tickets
- official results
- ledger transactions
- RNG requests
- RNG results
- settlement records
- audit logs
- override approvals

### Hash Fields

- `record_hash`
- `previous_hash`
- `hash_version`

### Signing Fields Reserved For Phase 4.8

- `signature`
- `signature_key_id`
- `signature_version`
- `signed_at`

### Hashing Notes

- Ledger transactions use hash chaining.
- Settlement records use hash chaining.
- Official results use hash chaining.
- RNG requests and results use individual record hashes.
- Audit logs use hash chaining.
- Override approvals use hash chaining after approval.
- Accepted tickets use individual record hashes at acceptance.

## 16. Implementation Notes

- Some constraints require database triggers or controlled database functions.
- Hierarchy cycle prevention requires a recursive check.
- Immutable rows require triggers or restricted permissions.
- Append-only protections should be enforced by database permissions and triggers.
- Application validation is not enough.
- Database protections must enforce critical anti-manipulation rules.
- Sensitive workflows should run through controlled APIs or stored procedures.
- Direct table writes to critical tables should be restricted in production.
- RNG provider secrets must be stored in a secret manager. Database rows store references only.

## 17. Anti-Manipulation Summary

Production must enforce:

- no ticket edits after acceptance
- no ticket acceptance after cutoff
- no direct result edits after official posting
- no duplicate settlement
- no ledger update/delete
- resettlement requires override authorization
- financial corrections use reversal transactions
- hierarchy moves are audited
- RNG requests are idempotent and audited
- RNG results are hashed and auditable
- sensitive permission changes require override approval

## 18. Open Questions

None for this phase. This document defines the constraint and audit architecture target before migrations are written.
