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

async function getBaseline() {
  const result = await requestJson("/api/authority/baseline-status", {
    headers: authHeaders(),
  });

  assert(
    result.response.status === 200 && result.body.success,
    "Baseline status endpoint failed.",
    { status: result.response.status, body: result.body }
  );

  return result.body.baselineStatus;
}

function assertPromotedCertifiedBaseline(baseline, label) {
  for (const domain of ["settlement", "ledger", "credit"]) {
    assert(baseline[domain].authority === "SERVICE", `${label}: ${domain} authority must be SERVICE.`, {
      baseline,
    });
    assert(
      baseline[domain].certificationStatus === "CERTIFIED",
      `${label}: ${domain} must be CERTIFIED.`,
      { baseline }
    );
    assert(
      baseline[domain].comparisonMode === "ENABLED",
      `${label}: ${domain} comparison must remain ENABLED.`,
      { baseline }
    );
    assert(
      baseline[domain].rollbackReadiness === "READY",
      `${label}: ${domain} rollback readiness must remain READY.`,
      { baseline }
    );
  }
}

const before = await getBaseline();
assertPromotedCertifiedBaseline(before, "Before golden path");

const result = spawnSync("npm", ["run", "qa:credit-launch"], {
  stdio: "inherit",
  env: process.env,
});

assert(result.status === 0, "Credit launch golden path failed.", {
  exitCode: result.status ?? 1,
});

const after = await getBaseline();
assertPromotedCertifiedBaseline(after, "After golden path");
assert(
  after.financialInvariants.checks.length > 0,
  "Financial invariant report should be present after golden path.",
  { after }
);
assert(after.credit.comparisonMode === "ENABLED", "Credit comparison changed.", {
  after,
});
assert(after.rollbackDrillSummary.overallStatus === "READY", "Rollback readiness changed.", {
  after,
});

pass("Post-extraction golden path completed.", {
  baselineBefore: before.overallBaselineStatus,
  baselineAfter: after.overallBaselineStatus,
  blockers: after.blockers,
  warnings: after.warnings,
});
