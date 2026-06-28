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
    assert(before[key] === after[key], `${key} mutated during security hardening QA.`, {
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

  return { response, body };
}

function assertPlatformState(platformState) {
  assert(platformState.settlement.authority === "SERVICE", "Settlement authority changed.", {
    platformState,
  });
  assert(
    platformState.settlement.certificationStatus === "CERTIFIED",
    "Settlement certification changed.",
    { platformState }
  );
  assert(platformState.ledger.authority === "SERVICE", "Ledger authority changed.", {
    platformState,
  });
  assert(platformState.ledger.certificationStatus === "CERTIFIED", "Ledger certification changed.", {
    platformState,
  });
  assert(platformState.credit.authority === "SERVICE", "Credit authority changed.", {
    platformState,
  });
  assert(platformState.credit.certificationStatus === "CERTIFIED", "Credit certification changed.", {
    platformState,
  });
  assert(
    platformState.settlement.comparisonMode === "ENABLED" &&
      platformState.ledger.comparisonMode === "ENABLED" &&
      platformState.credit.comparisonMode === "ENABLED",
    "Comparison mode changed.",
    { platformState }
  );
  assert(
    platformState.settlement.rollbackReadiness === "READY" &&
      platformState.ledger.rollbackReadiness === "READY" &&
      platformState.credit.rollbackReadiness === "READY",
    "Rollback readiness changed.",
    { platformState }
  );
}

function assertSecurityHeaders(response) {
  assert(
    response.headers.get("x-content-type-options") === "nosniff",
    "X-Content-Type-Options header missing."
  );
  assert(response.headers.get("x-frame-options") === "DENY", "X-Frame-Options header missing.");
  assert(Boolean(response.headers.get("referrer-policy")), "Referrer-Policy header missing.");
  assert(Boolean(response.headers.get("permissions-policy")), "Permissions-Policy header missing.");
  assert(
    Boolean(response.headers.get("content-security-policy")),
    "Content-Security-Policy header missing."
  );
}

await ensureSessionToken();

await Promise.all([
  assertProtected("/api/operations/security-status"),
  assertProtected("/api/operations/security-findings"),
  assertProtected("/api/operations/security-summary"),
]);
pass("Security APIs require auth.");

const beforeCounts = await snapshotCounts();
const statusPayload = await authGet("/api/operations/security-status");
const findingsPayload = await authGet("/api/operations/security-findings");
const summaryPayload = await authGet("/api/operations/security-summary");

assertSecurityHeaders(statusPayload.response);

const securityStatus = statusPayload.body.securityStatus;
const securityFindings = findingsPayload.body.securityFindings;
const securitySummary = summaryPayload.body.securitySummary;

assert(securityStatus.openCriticalCount === 0, "Open critical security findings detected.", {
  securityStatus,
});
assert(
  securityFindings.implementedImprovements.some(
    (finding) => finding.id === "SEC-HTTP-HEADERS-001"
  ),
  "Security header improvement was not reported.",
  { securityFindings }
);
assert(
  securitySummary.riskRegister.some((finding) => finding.category === "AUTHENTICATION"),
  "Authentication posture was not assessed.",
  { securitySummary }
);
assert(
  securitySummary.riskRegister.some((finding) => finding.category === "AUTHORIZATION"),
  "Authorization posture was not assessed.",
  { securitySummary }
);
assert(
  securitySummary.riskRegister.some((finding) => finding.category === "INFRASTRUCTURE_SECURITY"),
  "Infrastructure security posture was not assessed.",
  { securitySummary }
);
assertPlatformState(securityStatus.platformState);
assertPlatformState(securitySummary.platformState);

const afterCounts = await snapshotCounts();
assertCountsUnchanged(beforeCounts, afterCounts);

pass("Security hardening baseline validated.", {
  status: securityStatus.status,
  severitySummary: securityStatus.severitySummary,
  implementedImprovementCount: securityStatus.implementedImprovementCount,
  deferredItemCount: securitySummary.deferredItems.length,
});
