import "./load-session-env.mjs";
import { writeQaSessionFile } from "./lib/qa-auth-session.mjs";

const appUrl = process.env.QA_APP_URL || "http://localhost:3000";
let sessionToken =
  process.env.QA_ADMIN_SESSION_TOKEN ||
  process.env.OPS_ADMIN_SESSION_TOKEN;
const adminUsername = process.env.QA_ADMIN_USERNAME || "admin2";
const adminPassword = process.env.QA_ADMIN_PASSWORD || "";

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

function authHeaders() {
  if (!sessionToken) fail("QA_ADMIN_SESSION_TOKEN or OPS_ADMIN_SESSION_TOKEN is required.");

  return { authorization: `Bearer ${sessionToken}` };
}

await ensureSessionToken();

const { response, body } = await requestJson("/api/operations/failure-recovery-baseline", {
  headers: authHeaders(),
});

assert(response.status === 200 && body?.success === true, "Recovery drill baseline failed.", {
  status: response.status,
  body,
});

const baseline = body.failureRecoveryBaseline;

assert(baseline.measurementOnly === true, "Recovery drill baseline must be measurement-only.", {
  baseline,
});
assert(
  baseline.destructiveTestsPerformed === false,
  "Recovery drill baseline must not perform destructive tests.",
  { baseline }
);
assert(Array.isArray(baseline.scenarios) && baseline.scenarios.length >= 8, "Recovery drill scenarios are incomplete.", {
  baseline,
});
assert(
  baseline.scenarios.every(
    (scenario) => scenario.simulatedOnly === true && scenario.destructiveTest === false
  ),
  "Recovery drill scenarios must remain non-destructive.",
  { baseline }
);
assert(baseline.blockers.length === 0, "Recovery drill baseline has blockers.", {
  baseline,
});

pass("Recovery drills QA completed.", {
  status: baseline.status,
  scenarioCount: baseline.scenarios.length,
  warnings: baseline.warnings,
});
