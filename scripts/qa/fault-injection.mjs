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
    assert(before[key] === after[key], `${key} mutated during fault injection QA.`, {
      before,
      after,
    });
  }
}

async function assertProtected(path, method = "GET") {
  const { response, body } = await requestJson(path, {
    method,
    headers: method === "POST" ? { "content-type": "application/json" } : {},
    body: method === "POST" ? JSON.stringify({}) : undefined,
  });

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

async function simulate(drill, confirm = true) {
  const { response, body } = await requestJson("/api/operations/fault-injection/simulate", {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ drill, confirm }),
  });

  return { response, body };
}

function assertAuthority(status) {
  assert(status.authority.settlement === "SERVICE", "Settlement authority changed.", { status });
  assert(status.authority.ledger === "SERVICE", "Ledger authority changed.", { status });
  assert(status.authority.credit === "SERVICE", "Credit authority changed.", { status });
  assert(status.certification.settlement === "CERTIFIED", "Settlement certification changed.", { status });
  assert(status.certification.ledger === "CERTIFIED", "Ledger certification changed.", { status });
  assert(status.certification.credit === "CERTIFIED", "Credit certification changed.", { status });
  assert(status.comparison.settlement === "ENABLED", "Settlement comparison changed.", { status });
  assert(status.comparison.ledger === "ENABLED", "Ledger comparison changed.", { status });
  assert(status.comparison.credit === "ENABLED", "Credit comparison changed.", { status });
  assert(status.rollback.overall === "READY", "Rollback readiness changed.", { status });
}

await ensureSessionToken();

await Promise.all([
  assertProtected("/api/operations/fault-injection-status"),
  assertProtected("/api/operations/fault-recovery-metrics"),
  assertProtected("/api/operations/fault-injection/simulate", "POST"),
]);
pass("Fault injection APIs require auth.");

const beforeCounts = await snapshotCounts();
const statusPayload = await authGet("/api/operations/fault-injection-status");
const metricsPayload = await authGet("/api/operations/fault-recovery-metrics");
const status = statusPayload.faultInjectionStatus;
const metrics = metricsPayload.faultRecoveryMetrics;

assertAuthority(status);
assert(status.readyForFaultInjection === true, "Fault injection precheck is not ready.", {
  status,
});
assert(metrics.financialIntegrityVerified === true, "Financial integrity was not verified.", {
  metrics,
});
assert(metrics.replayProtectionMaintained === true, "Replay protection was not maintained.", {
  metrics,
});
assert(metrics.duplicateDetection.duplicateEvents === 0, "Duplicate events detected.", {
  metrics,
});
assert(metrics.duplicateDetection.duplicateTickets === 0, "Duplicate tickets detected.", {
  metrics,
});
assert(metrics.duplicateDetection.duplicateSettlements === 0, "Duplicate settlements detected.", {
  metrics,
});
assert(metrics.duplicateDetection.duplicateLedgerEntries === 0, "Duplicate ledger entries detected.", {
  metrics,
});
assert(
  metrics.duplicateDetection.duplicateCreditReservations === 0,
  "Duplicate credit reservations detected.",
  { metrics }
);
assert(status.dispatcherHeartbeatVisible === true, "Dispatcher heartbeat is not visible.", {
  status,
});
assert(status.freshWorkerCount > 0, "Fresh worker heartbeat is not visible.", { status });
assert(status.rabbitmqVisible === true, "RabbitMQ health is not visible.", { status });
assert(status.redisVisible === true, "Redis health is not visible.", { status });

const missingConfirmation = await simulate("RESTART_OUTBOX_DISPATCHER", false);
assert(missingConfirmation.response.status === 400, "Missing confirmation should be rejected.", {
  body: missingConfirmation.body,
  status: missingConfirmation.response.status,
});

const unsupported = await simulate("DROP_DATABASE", true);
assert(unsupported.response.status === 400, "Unsupported drill should be rejected.", {
  body: unsupported.body,
  status: unsupported.response.status,
});

const executed = [];

for (const drill of status.supportedDrills) {
  const result = await simulate(drill, true);

  assert(result.response.status === 200 && result.body?.success === true, "Supported drill simulation failed.", {
    drill,
    status: result.response.status,
    body: result.body,
  });

  const simulation = result.body.faultInjectionSimulation;

  assert(simulation.explicitConfirmation === true, "Simulation did not record confirmation.", {
    drill,
    simulation,
  });
  assert(simulation.recoveryMetrics.financialIntegrityVerified === true, "Financial integrity failed in simulation.", {
    drill,
    simulation,
  });
  assert(simulation.recoveryMetrics.replayProtectionMaintained === true, "Replay protection failed in simulation.", {
    drill,
    simulation,
  });
  executed.push({
    drill,
    status: simulation.status,
    recoveryTimeMs: simulation.recoveryMetrics.estimatedRecoveryTimeMs,
  });
}

const afterCounts = await snapshotCounts();
assertCountsUnchanged(beforeCounts, afterCounts);

pass("Fault injection QA completed.", {
  executed,
  duplicateDetection: metrics.duplicateDetection,
  recoveryTimeMs: metrics.estimatedRecoveryTimeMs,
  warnings: [...new Set([...(status.warnings ?? []), ...(metrics.warnings ?? [])])],
  beforeCounts,
  afterCounts,
});
