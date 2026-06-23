import "./load-session-env.mjs";

const appUrl = process.env.QA_APP_URL || "http://localhost:3000";
const sessionToken = process.env.QA_ADMIN_SESSION_TOKEN;

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

async function requestJson(path, authenticated = true) {
  const response = await fetch(`${appUrl}${path}`, {
    headers: authenticated && sessionToken ? { authorization: `Bearer ${sessionToken}` } : {},
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  return { response, body };
}

const unauthenticated = await requestJson("/api/authority/ledger-dry-run-evaluation", false);
assert(unauthenticated.response.status === 401, "Ledger dry-run should require auth.", {
  status: unauthenticated.response.status,
});
pass("Ledger dry-run endpoint requires auth.");

if (!sessionToken) fail("QA_ADMIN_SESSION_TOKEN is required.");

const result = await requestJson("/api/authority/ledger-dry-run-evaluation");
assert(result.response.status === 200 && result.body.success, "Ledger dry-run evaluation failed.", {
  status: result.response.status,
  body: result.body,
});
const dryRun = result.body.dryRunEvaluation;

assert(dryRun.authorityCandidate === "LEDGER", "Ledger dry-run domain mismatch.", { dryRun });
assert(typeof dryRun.ifServiceBecameAuthoritativeNow.wouldRollbackTrigger === "boolean", "Dry-run rollback trigger missing.", {
  dryRun,
});
assert(Array.isArray(dryRun.approvalRequirements), "Approval requirements missing.", { dryRun });

pass("Ledger dry-run evaluation is advisory-only.", {
  currentState: dryRun.currentState,
  evaluation: dryRun.ifServiceBecameAuthoritativeNow,
  approvalRequirements: dryRun.approvalRequirements,
});
