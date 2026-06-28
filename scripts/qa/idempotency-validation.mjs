import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import "./load-session-env.mjs";
import {
  getQaSupabaseAccessUrl,
  getServiceRoleKey,
  writeQaSessionFile,
} from "./lib/qa-auth-session.mjs";

const appUrl = process.env.QA_APP_URL || "http://localhost:3000";
let sessionToken =
  process.env.QA_ADMIN_SESSION_TOKEN || process.env.OPS_ADMIN_SESSION_TOKEN;
const adminUsername = process.env.QA_ADMIN_USERNAME || "admin2";
const adminPassword = process.env.QA_ADMIN_PASSWORD || "";
const supabaseUrl = getQaSupabaseAccessUrl();
const serviceRoleKey = getServiceRoleKey();

function fail(message, metadata = {}) {
  console.error(JSON.stringify({ status: "FAIL", message, ...metadata }, null, 2));
  process.exit(1);
}

function pass(message, metadata = {}) {
  console.log(JSON.stringify({ status: "PASS", message, ...metadata }, null, 2));
}

function assert(condition, message, metadata = {}) {
  if (!condition) fail(message, metadata);
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${appUrl}${path}`, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  return { response, body };
}

async function ensureSessionToken() {
  if (sessionToken) {
    const { response } = await requestJson("/api/auth/me", {
      headers: { authorization: `Bearer ${sessionToken}` },
    });

    if (response.ok) return;
  }

  if (!adminPassword) {
    fail("A valid QA admin session token or QA_ADMIN_PASSWORD is required.");
  }

  const { response, body } = await requestJson("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: adminUsername,
      password: adminPassword,
    }),
  });

  assert(response.status === 200 && body?.success === true && body.sessionToken, "Admin login failed.", {
    status: response.status,
    body,
  });

  sessionToken = body.sessionToken;
  writeQaSessionFile({
    sessionToken,
    expiresAt: body.expiresAt,
  });
}

function authHeaders(extra = {}) {
  if (!sessionToken) fail("QA_ADMIN_SESSION_TOKEN or OPS_ADMIN_SESSION_TOKEN is required.");

  return {
    authorization: `Bearer ${sessionToken}`,
    ...extra,
  };
}

function createQaSupabaseClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    fail("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      transport: WebSocket,
    },
  });
}

async function countRows(supabase, table) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });

  if (error) fail(`Unable to count ${table}.`, { error: error.message });

  return count ?? 0;
}

async function snapshotCounts() {
  const supabase = createQaSupabaseClient();
  const [tickets, reservations, settlements, ledgerEntries, wallets, outboxEvents] =
    await Promise.all([
      countRows(supabase, "tickets"),
      countRows(supabase, "credit_reservations"),
      countRows(supabase, "credit_settlement_applications"),
      countRows(supabase, "financial_ledger_entries"),
      countRows(supabase, "financial_wallets"),
      countRows(supabase, "outbox_events"),
    ]);

  return {
    tickets,
    reservations,
    settlements,
    ledgerEntries,
    wallets,
    outboxEvents,
  };
}

function assertCountsUnchanged(before, after) {
  for (const key of Object.keys(before)) {
    assert(before[key] === after[key], `${key} mutated during idempotency validation QA.`, {
      before,
      after,
    });
  }
}

async function assertProtected(path) {
  const { response, body } = await requestJson(path);

  assert(response.status === 401 || response.status === 403, `${path} should require auth.`, {
    status: response.status,
    body,
  });
}

async function authGet(path) {
  const { response, body } = await requestJson(path, { headers: authHeaders() });

  assert(response.status === 200 && body?.success === true, `${path} failed.`, {
    status: response.status,
    body,
  });

  return body;
}

function assertAuthorityBaseline(status) {
  assert(status.authority.settlement === "SERVICE", "Settlement authority changed.", { status });
  assert(status.authority.ledger === "SERVICE", "Ledger authority changed.", { status });
  assert(status.authority.credit === "SERVICE", "Credit authority changed.", { status });
  assert(status.certification.settlement === "CERTIFIED", "Settlement certification changed.", { status });
  assert(status.certification.ledger === "CERTIFIED", "Ledger certification changed.", { status });
  assert(status.certification.credit === "CERTIFIED", "Credit certification changed.", { status });
  assert(status.comparison.settlement === "ENABLED", "Settlement comparison changed.", { status });
  assert(status.comparison.ledger === "ENABLED", "Ledger comparison changed.", { status });
  assert(status.comparison.credit === "ENABLED", "Credit comparison changed.", { status });
  assert(status.rollback.settlement === "READY", "Settlement rollback readiness changed.", { status });
  assert(status.rollback.ledger === "READY", "Ledger rollback readiness changed.", { status });
  assert(status.rollback.credit === "READY", "Credit rollback readiness changed.", { status });
  assert(status.rollback.overall === "READY", "Overall rollback readiness changed.", { status });
}

await ensureSessionToken();

await Promise.all([
  assertProtected("/api/operations/idempotency-validation"),
  assertProtected("/api/operations/retry-validation"),
  assertProtected("/api/operations/event-replay-status"),
]);
pass("Retry and idempotency validation APIs require auth.");

const beforeCounts = await snapshotCounts();
const [statusPayload, idempotencyPayload, retryPayload, replayPayload] =
  await Promise.all([
    authGet("/api/operations/resilience-status"),
    authGet("/api/operations/idempotency-validation"),
    authGet("/api/operations/retry-validation"),
    authGet("/api/operations/event-replay-status"),
  ]);
const resilienceStatus = statusPayload.resilienceStatus;
const idempotency = idempotencyPayload.idempotencyValidation;
const retry = retryPayload.retryValidation;
const replay = replayPayload.eventReplayStatus;

assertAuthorityBaseline(resilienceStatus);
assert(idempotency.readOnly === true, "Idempotency validation must be read-only.", {
  idempotency,
});
assert(retry.readOnly === true, "Retry validation must be read-only.", { retry });
assert(replay.readOnly === true, "Event replay status must be read-only.", { replay });
assert(idempotency.duplicateEvents === 0, "Duplicate events were detected.", {
  idempotency,
});
assert(idempotency.duplicateTickets === 0, "Duplicate tickets were detected.", {
  idempotency,
});
assert(idempotency.duplicateSettlements === 0, "Duplicate settlements were detected.", {
  idempotency,
});
assert(idempotency.duplicateLedgerEntries === 0, "Duplicate ledger entries were detected.", {
  idempotency,
});
assert(
  idempotency.duplicateCreditReservations === 0,
  "Duplicate credit reservations were detected.",
  { idempotency }
);
assert(idempotency.replayProtectionVerified === true, "Replay protection was not verified.", {
  idempotency,
});
assert(idempotency.correlationIdsRespected === true, "Correlation ID evidence is missing.", {
  idempotency,
});
assert(idempotency.idempotencyKeysRespected === true, "Idempotency key evidence is missing.", {
  idempotency,
});
assert(replay.replayProtectionVerified === true, "Event replay protection was not verified.", {
  replay,
});
assert(replay.duplicatePublishedEvents === 0, "Duplicate published events were detected.", {
  replay,
});
assert(replay.duplicateOutboxEventIds === 0, "Duplicate outbox event IDs were detected.", {
  replay,
});

const expectedScenarios = new Set([
  "OUTBOX_DISPATCHER_RESTART",
  "RABBITMQ_RECONNECT",
  "WORKER_RESTART",
  "DUPLICATE_MESSAGE_DELIVERY",
  "DISPATCHER_RESTART_DURING_PUBLISH",
  "WORKER_RESTART_DURING_PROCESSING",
  "MULTIPLE_CONSUMER_RETRY",
  "REPLAY_ALREADY_PROCESSED_EVENT",
  "DUPLICATE_HTTP_RETRY",
]);

assert(
  Array.isArray(retry.scenarios) && retry.scenarios.length >= expectedScenarios.size,
  "Retry scenarios are incomplete.",
  { retry }
);

for (const scenario of retry.scenarios) {
  expectedScenarios.delete(scenario.name);
  assert(scenario.readOnly === true, `${scenario.name} must be read-only.`, { scenario });
  assert(scenario.safe === true, `${scenario.name} was not validated as safe.`, {
    scenario,
  });
}

assert(expectedScenarios.size === 0, "Required retry scenarios are missing.", {
  missing: [...expectedScenarios],
  retry,
});
assert(retry.blockers.length === 0, "Retry validation reported blockers.", { retry });

const afterCounts = await snapshotCounts();
assertCountsUnchanged(beforeCounts, afterCounts);

pass("Retry and idempotency validation QA completed.", {
  idempotencyStatus: idempotency.status,
  retryStatus: retry.status,
  replayStatus: replay.status,
  scenarioCount: retry.scenarios.length,
  duplicateEvents: idempotency.duplicateEvents,
  duplicateTickets: idempotency.duplicateTickets,
  duplicateSettlements: idempotency.duplicateSettlements,
  duplicateLedgerEntries: idempotency.duplicateLedgerEntries,
  duplicateCreditReservations: idempotency.duplicateCreditReservations,
  warnings: [...new Set([...(idempotency.warnings ?? []), ...(retry.warnings ?? [])])],
  beforeCounts,
  afterCounts,
});
