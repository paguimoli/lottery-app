const appUrl = process.env.OPERATIONS_APP_URL || "http://localhost:3000";
const sessionToken = process.env.OPERATIONS_SESSION_TOKEN || process.env.QA_ADMIN_SESSION_TOKEN;
const windowArg = process.argv.find((arg) => arg.startsWith("--window="));
const window = windowArg?.split("=")[1] || "7d";

if (!sessionToken) {
  console.error("OPERATIONS_SESSION_TOKEN or QA_ADMIN_SESSION_TOKEN is required.");
  process.exit(1);
}

const response = await fetch(`${appUrl}/api/shadow-readiness?window=${encodeURIComponent(window)}`, {
  headers: { authorization: `Bearer ${sessionToken}` },
});
const body = await response.json();

if (!response.ok || !body.success) {
  console.error(JSON.stringify({ status: "FAIL", responseStatus: response.status, body }, null, 2));
  process.exit(1);
}

const readiness = body.readiness;
const rows = Object.values(readiness.domains).map((domain) => ({
  domain: domain.label,
  status: domain.readinessStatus,
  matchRate: domain.matchRate,
  mismatchRate: domain.mismatchRate,
  failureRate: domain.failureRate,
  criticalMismatchCount: domain.criticalMismatchCount,
}));

console.log(JSON.stringify({
  status: "PASS",
  window: readiness.window,
  domains: rows,
  platformReadiness: readiness.platform.platformStatus,
  recommendation: readiness.extractionRecommendation,
}, null, 2));
