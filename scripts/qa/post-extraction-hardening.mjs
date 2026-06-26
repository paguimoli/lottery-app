import "./load-session-env.mjs";

import { spawnSync } from "node:child_process";

const appUrl = process.env.QA_APP_URL || "http://localhost:3000";
const sessionToken =
  process.env.QA_ADMIN_SESSION_TOKEN || process.env.OPS_ADMIN_SESSION_TOKEN;

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

function authHeaders(extra = {}) {
  if (!sessionToken) fail("QA_ADMIN_SESSION_TOKEN or OPS_ADMIN_SESSION_TOKEN is required.");

  return {
    authorization: `Bearer ${sessionToken}`,
    ...extra,
  };
}

const unauthenticated = await requestJson("/api/authority/baseline-status");
assert(
  unauthenticated.response.status === 401,
  "Baseline status endpoint should require auth.",
  { status: unauthenticated.response.status, body: unauthenticated.body }
);
pass("Baseline status endpoint requires auth.");

const goldenPath = spawnSync("npm", ["run", "qa:post-extraction-golden-path"], {
  stdio: "inherit",
  env: process.env,
});
assert(goldenPath.status === 0, "Post-extraction golden path QA should pass.", {
  exitCode: goldenPath.status ?? 1,
});
pass("Post-extraction golden path QA passed.");

const result = await requestJson("/api/authority/baseline-status", {
  headers: authHeaders(),
});
assert(
  result.response.status === 200 && result.body.success,
  "Baseline status endpoint failed.",
  { status: result.response.status, body: result.body }
);

const baseline = result.body.baselineStatus;

for (const domain of ["settlement", "ledger", "credit"]) {
  assert(baseline[domain].authority === "SERVICE", `${domain} authority must be SERVICE.`, {
    baseline,
  });
  assert(
    baseline[domain].certificationStatus === "CERTIFIED",
    `${domain} certification must be CERTIFIED.`,
    { baseline }
  );
  assert(
    baseline[domain].rollbackReadiness === "READY",
    `${domain} rollback readiness must be READY.`,
    { baseline }
  );
  assert(
    baseline[domain].comparisonMode === "ENABLED",
    `${domain} comparison mode must be ENABLED.`,
    { baseline }
  );
  assert(
    baseline[domain].serviceHealth.available === true,
    `${domain} service health must be available.`,
    { baseline }
  );
}

assert(
  baseline.financialInvariants.checks.length >= 7,
  "Financial invariant report was not generated.",
  { baseline }
);
assert(
  baseline.eventAudit.recentAuthorityEvents.length > 0,
  "Outbox/event audit report was not generated.",
  { baseline }
);
assert(
  baseline.serviceWorkerObservability.appHealth.available === true,
  "App health must be available.",
  { baseline }
);
assert(
  baseline.serviceWorkerObservability.redisHealth.available === true,
  "Redis health must be available.",
  { baseline }
);
assert(
  baseline.rollbackDrillSummary.overallStatus === "READY",
  "Baseline rollback drill readiness must be READY.",
  { baseline }
);

pass("Post-extraction hardening baseline QA completed.", {
  overallBaselineStatus: baseline.overallBaselineStatus,
  blockers: baseline.blockers,
  warnings: baseline.warnings,
  invariantStatus: baseline.financialInvariants.status,
  eventAuditStatus: baseline.eventAudit.status,
  serviceWorkerStatus: baseline.serviceWorkerObservability.status,
});
