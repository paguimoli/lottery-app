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

const response = await fetch(`${appUrl}/api/operations/database-performance`, {
  headers: { authorization: `Bearer ${sessionToken}` },
});
const payload = await response.json().catch(() => ({}));

if (!response.ok || !payload.success) {
  fail("Database performance endpoint failed.", {
    status: response.status,
    error: payload.error ?? "unknown",
  });
}

const report = payload.databasePerformance;

console.log(`generatedAt: ${report.generatedAt}`);
console.log(`measurementOnly: ${report.measurementOnly}`);
console.log(`measurementIntervalMs: ${report.measurementIntervalMs}`);
console.log(`overallDbHealth: ${report.recommendations.some((item) => item.impact === "HIGH") ? "WARNING" : "READY"}`);
console.log(`averageQueryMs: ${report.latency.averageMs ?? "unavailable"}`);
console.log(`medianQueryMs: ${report.latency.medianMs ?? "unavailable"}`);
console.log(`p95QueryMs: ${report.latency.p95Ms ?? "unavailable"}`);
console.log(`p99QueryMs: ${report.latency.p99Ms ?? "unavailable"}`);
console.log(`maxQueryMs: ${report.latency.maxMs ?? "unavailable"}`);
console.log(`queryCount: ${report.latency.queryCount}`);
console.log(`queriesPerSecond: ${report.latency.queriesPerSecond}`);
console.log(`readsPerSecond: ${report.latency.readsPerSecond}`);
console.log(`writesPerSecond: ${report.latency.writesPerSecond}`);
console.log(`readWriteRatio: ${report.latency.readWriteRatio}`);
console.log(`poolStatus: ${report.connections.status}`);
console.log(`poolUtilization: ${report.connections.poolUtilization ?? "unavailable"}`);
console.log(`activeConnections: ${report.connections.activeConnections ?? "unavailable"}`);
console.log(`idleConnections: ${report.connections.idleConnections ?? "unavailable"}`);
console.log(`waitingConnections: ${report.connections.waitingConnections ?? "unavailable"}`);
console.log(`transactionStatus: ${report.transactions.status}`);
console.log(`transactionCount: ${report.transactions.transactionCount}`);
console.log(`averageTransactionMs: ${report.transactions.averageTransactionDurationMs ?? "unavailable"}`);
console.log("topSlowQueries:");
for (const query of report.slowQueries.topSlowQueries.slice(0, 10)) {
  console.log(`- ${query.label} ${query.durationMs ?? "unavailable"}ms ${query.table}`);
}
console.log("repositoryRanking:");
for (const hotspot of report.repositoryHotspots.slice(0, 10)) {
  console.log(`${hotspot.rank}. ${hotspot.name} indicators=${hotspot.queryCount} maxMs=${hotspot.measuredMaxMs ?? "unavailable"}`);
}
console.log("endpointRanking:");
for (const hotspot of report.apiHotspots.slice(0, 10)) {
  console.log(`${hotspot.rank}. ${hotspot.name} indicators=${hotspot.queryCount} maxMs=${hotspot.measuredMaxMs ?? "unavailable"}`);
}
console.log("recommendations:");
for (const item of report.recommendations) {
  console.log(`${item.rank}. ${item.impact} ${item.area} ${item.metric}: ${item.observedValue}`);
}
