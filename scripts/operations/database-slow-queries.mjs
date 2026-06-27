import "../qa/load-session-env.mjs";

const appUrl = process.env.OPS_APP_URL || process.env.QA_APP_URL || "http://localhost:3000";
const sessionToken =
  process.env.OPS_ADMIN_SESSION_TOKEN || process.env.QA_ADMIN_SESSION_TOKEN;

function fail(message, metadata = {}) {
  console.error(message);
  for (const [key, value] of Object.entries(metadata)) {
    console.error(`${key}: ${value}`);
  }
  process.exit(1);
}

if (!sessionToken) fail("OPS_ADMIN_SESSION_TOKEN or QA_ADMIN_SESSION_TOKEN is required.");

const response = await fetch(`${appUrl}/api/operations/database-slow-queries`, {
  headers: { authorization: `Bearer ${sessionToken}` },
});
const payload = await response.json().catch(() => ({}));

if (!response.ok || !payload.success) {
  fail("Database slow query endpoint failed.", {
    status: response.status,
    error: payload.error ?? "unknown",
  });
}

const report = payload.slowQueries;

console.log(`generatedAt: ${report.generatedAt}`);
console.log(`measurementIntervalMs: ${report.measurementIntervalMs}`);
console.log(`thresholdMs: ${report.thresholdMs}`);
console.log("histogram:");
for (const bucket of report.histogram) {
  console.log(`- ${bucket.label}: ${bucket.count}`);
}
console.log("topSlowQueries:");
for (const query of report.topSlowQueries.slice(0, 10)) {
  console.log(`- ${query.label} ${query.durationMs ?? "unavailable"}ms table=${query.table} rows=${query.rowCount ?? "unavailable"}`);
}
console.log("topQueriedTables:");
for (const table of report.topQueriedTables.slice(0, 10)) {
  console.log(`- ${table.table} queries=${table.queryCount} avgMs=${table.averageDurationMs ?? "unavailable"} maxMs=${table.maxDurationMs ?? "unavailable"}`);
}
