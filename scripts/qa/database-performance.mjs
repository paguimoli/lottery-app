import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import "./load-session-env.mjs";

const appUrl = process.env.QA_APP_URL || "http://localhost:3000";
const sessionToken =
  process.env.QA_ADMIN_SESSION_TOKEN || process.env.OPS_ADMIN_SESSION_TOKEN;
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

function authHeaders(extra = {}) {
  if (!sessionToken) fail("QA_ADMIN_SESSION_TOKEN or OPS_ADMIN_SESSION_TOKEN is required.");

  return {
    authorization: `Bearer ${sessionToken}`,
    ...extra,
  };
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${appUrl}${path}`, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  return { response, body };
}

async function assertProtected(path) {
  const result = await requestJson(path);

  assert(result.response.status === 401, `${path} should require auth.`, {
    status: result.response.status,
    body: result.body,
  });
}

async function authGet(path) {
  const result = await requestJson(path, { headers: authHeaders() });

  assert(result.response.status === 200 && result.body.success, `${path} failed.`, {
    status: result.response.status,
    body: result.body,
  });

  return result.body;
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

async function snapshotFinancialCounts() {
  const supabase = createQaSupabaseClient();
  const [
    ledgerEntries,
    creditReservations,
    creditSettlementApplications,
    financialWallets,
    authorityApprovals,
  ] = await Promise.all([
    countRows(supabase, "financial_ledger_entries"),
    countRows(supabase, "credit_reservations"),
    countRows(supabase, "credit_settlement_applications"),
    countRows(supabase, "financial_wallets"),
    countRows(supabase, "authority_approval_records"),
  ]);

  return {
    ledgerEntries,
    creditReservations,
    creditSettlementApplications,
    financialWallets,
    authorityApprovals,
  };
}

function assertAuthorityBaseline(baseline) {
  for (const domain of ["settlement", "ledger", "credit"]) {
    assert(baseline[domain].authority === "SERVICE", `${domain} authority changed.`, {
      baseline,
    });
    assert(
      baseline[domain].certificationStatus === "CERTIFIED",
      `${domain} certification changed.`,
      { baseline }
    );
    assert(
      baseline[domain].comparisonMode === "ENABLED",
      `${domain} comparison mode changed.`,
      { baseline }
    );
    assert(
      baseline[domain].rollbackReadiness === "READY",
      `${domain} rollback readiness changed.`,
      { baseline }
    );
  }
}

await Promise.all([
  assertProtected("/api/operations/database-performance"),
  assertProtected("/api/operations/database-slow-queries"),
  assertProtected("/api/operations/database-connections"),
  assertProtected("/api/operations/database-transactions"),
]);
pass("Database performance APIs require auth.");

const beforeCounts = await snapshotFinancialCounts();
const [
  databasePerformancePayload,
  slowQueriesPayload,
  connectionsPayload,
  transactionsPayload,
  baselinePayload,
] = await Promise.all([
  authGet("/api/operations/database-performance"),
  authGet("/api/operations/database-slow-queries"),
  authGet("/api/operations/database-connections"),
  authGet("/api/operations/database-transactions"),
  authGet("/api/operations/performance-baseline"),
]);
const afterCounts = await snapshotFinancialCounts();

const report = databasePerformancePayload.databasePerformance;
const slowQueries = slowQueriesPayload.slowQueries;
const connections = connectionsPayload.connections;
const transactions = transactionsPayload.transactions;
const baseline = baselinePayload.performanceBaseline;

assert(report.measurementOnly === true, "Database performance report must be measurement-only.", {
  report,
});
assert(report.measurements.length > 0, "Database measurements were not generated.", {
  report,
});
assert(report.latency.queryCount === report.measurements.length, "Query count is inconsistent.", {
  latency: report.latency,
  measurementCount: report.measurements.length,
});
assert(report.latency.readWriteRatio.includes(":"), "Read/write ratio was not generated.", {
  latency: report.latency,
});
assert(
  report.latency.averageMs === null || report.latency.averageMs >= 0,
  "Average query duration is invalid.",
  { latency: report.latency }
);
assert(
  Array.isArray(report.slowQueries.histogram) && report.slowQueries.histogram.length > 0,
  "Slow query histogram was not generated.",
  { slowQueries: report.slowQueries }
);
assert(
  Array.isArray(report.slowQueries.topSlowQueries) &&
    report.slowQueries.topSlowQueries.length > 0,
  "Top slow query report was not generated.",
  { slowQueries: report.slowQueries }
);
assert(
  Array.isArray(report.repositoryHotspots) && report.repositoryHotspots.length > 0,
  "Repository hotspot ranking was not generated.",
  { repositoryHotspots: report.repositoryHotspots }
);
assert(
  Array.isArray(report.apiHotspots) && report.apiHotspots.length > 0,
  "API hotspot ranking was not generated.",
  { apiHotspots: report.apiHotspots }
);
assert(
  Array.isArray(report.recommendations) && report.recommendations.length > 0,
  "Database performance recommendations were not generated.",
  { recommendations: report.recommendations }
);
assert(slowQueries.topSlowQueries.length > 0, "Slow query endpoint returned no report.", {
  slowQueries,
});
assert(
  connections.status && Object.hasOwn(connections, "activeConnections"),
  "Connection metrics were not returned.",
  { connections }
);
assert(
  transactions.status && transactions.transactionCount >= 0,
  "Transaction metrics were not returned.",
  { transactions }
);
assert(
  baseline.databasePerformance?.measurementOnly === true,
  "Performance baseline did not include database performance telemetry.",
  { databasePerformance: baseline.databasePerformance }
);
assertAuthorityBaseline(baseline.authorityBaseline);
assert(
  JSON.stringify(beforeCounts) === JSON.stringify(afterCounts),
  "Database performance telemetry mutated financial or authority records.",
  { beforeCounts, afterCounts }
);

pass("Database performance telemetry QA completed.", {
  averageQueryMs: report.latency.averageMs,
  medianQueryMs: report.latency.medianMs,
  p95QueryMs: report.latency.p95Ms,
  p99QueryMs: report.latency.p99Ms,
  maxQueryMs: report.latency.maxMs,
  queryCount: report.latency.queryCount,
  readWriteRatio: report.latency.readWriteRatio,
  connectionStatus: connections.status,
  transactionStatus: transactions.status,
  topSlowQuery: report.slowQueries.topSlowQueries[0],
  topRepositoryHotspot: report.repositoryHotspots[0],
  topApiHotspot: report.apiHotspots[0],
  beforeCounts,
  afterCounts,
});
