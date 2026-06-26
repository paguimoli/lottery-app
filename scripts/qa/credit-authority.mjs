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

async function requestJson(path, options = {}) {
  const response = await fetch(`${appUrl}${path}`, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  return { response, body };
}

function authHeaders() {
  if (!sessionToken) fail("QA_ADMIN_SESSION_TOKEN is required.");

  return { authorization: `Bearer ${sessionToken}` };
}

const unauthenticated = await requestJson("/api/authority/credit-readiness");
assert(unauthenticated.response.status === 401, "Credit readiness should require auth.", {
  status: unauthenticated.response.status,
  body: unauthenticated.body,
});
pass("Credit readiness endpoint requires auth.");

const [readinessResult, rollbackResult, authorityResult] = await Promise.all([
  requestJson("/api/authority/credit-readiness", { headers: authHeaders() }),
  requestJson("/api/authority/credit-rollback-readiness", {
    headers: authHeaders(),
  }),
  requestJson("/api/authority/status", { headers: authHeaders() }),
]);

assert(readinessResult.response.status === 200 && readinessResult.body.success, "Credit readiness failed.", {
  status: readinessResult.response.status,
  body: readinessResult.body,
});
assert(rollbackResult.response.status === 200 && rollbackResult.body.success, "Credit rollback readiness failed.", {
  status: rollbackResult.response.status,
  body: rollbackResult.body,
});
assert(authorityResult.response.status === 200 && authorityResult.body.success, "Authority status failed.", {
  status: authorityResult.response.status,
  body: authorityResult.body,
});

const readiness = readinessResult.body.readiness;
const authority = authorityResult.body.authority;
assert(
  readiness.authority === "MONOLITH" || readiness.authority === "SERVICE",
  "Credit authority should be a supported lifecycle state.",
  {
    readiness,
  }
);
assert(authority.credit.authority === readiness.authority, "Credit authority status mismatch.", {
  readiness,
  authority,
});
assert(readiness.comparisonMode === "ENABLED", "Credit comparison must remain ENABLED.", {
  readiness,
});
assert(readiness.rollbackReadinessStatus === "READY", "Credit rollback readiness must be READY.", {
  readiness,
});
if (readiness.authority === "MONOLITH") {
  assert(
    readiness.runtimeRoute.productionCutoverActive === false,
    "Credit production cutover must remain inactive before promotion.",
    { readiness }
  );
  assert(readiness.runtimeRoute.comparisonPath === "CREDIT_SERVICE", "Credit comparison path mismatch.", {
    readiness,
  });
} else {
  assert(
    readiness.runtimeRoute.productionCutoverActive === true,
    "Credit production cutover should be active after promotion.",
    { readiness }
  );
  assert(readiness.runtimeRoute.comparisonPath === "MONOLITH", "Credit comparison path mismatch after promotion.", {
    readiness,
  });
}
assert(authority.credit.comparisonMode === "ENABLED", "Credit comparison status changed.", {
  readiness,
  authority,
});
assert(rollbackResult.body.rollbackReadiness.rollbackStatus === "READY", "Credit rollback endpoint should report READY.", {
  rollbackReadiness: rollbackResult.body.rollbackReadiness,
});
assert(authority.settlement.authority === "SERVICE", "Settlement authority changed.", {
  authority,
});
assert(authority.ledger.authority === "SERVICE", "Ledger authority changed.", {
  authority,
});

pass("Credit authority candidate controls are ready.", {
  authority: readiness.authority,
  comparisonMode: readiness.comparisonMode,
  rollbackReadinessStatus: readiness.rollbackReadinessStatus,
  remainingBlockers: readiness.remainingBlockers,
});
