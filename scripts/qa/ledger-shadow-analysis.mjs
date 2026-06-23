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

async function get(path, authenticated = true) {
  const response = await fetch(`${appUrl}${path}`, {
    headers: authenticated && sessionToken ? { authorization: `Bearer ${sessionToken}` } : {},
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  return { response, body };
}

const unauthenticated = await get("/api/shadow-analysis/summary", false);
assert(unauthenticated.response.status === 401, "Shadow analysis should require auth.", {
  status: unauthenticated.response.status,
});
pass("Shadow analysis endpoint requires auth.");

if (!sessionToken) fail("QA_ADMIN_SESSION_TOKEN is required.");

const result = await get("/api/shadow-analysis/summary?window=all");
assert(result.response.status === 200 && result.body.success, "Shadow analysis failed.", {
  status: result.response.status,
  body: result.body,
});

const ledger = result.body.analysis.domains.ledger;
assert(ledger, "Ledger shadow analysis missing.", { body: result.body });
assert(ledger.rawReadiness, "Ledger raw readiness missing.", { ledger });
assert(ledger.adjustedReadiness, "Ledger adjusted readiness missing.", { ledger });
assert(ledger.promotionReadiness, "Ledger promotion readiness missing.", { ledger });

pass("Ledger shadow analysis reports raw, adjusted, and promotion readiness.", {
  raw: ledger.rawReadiness,
  adjusted: ledger.adjustedReadiness,
  promotion: ledger.promotionReadiness,
});
