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

const unauthenticated = await requestJson("/api/authority/ledger-lifecycle/summary", false);
assert(unauthenticated.response.status === 401, "Ledger lifecycle should require auth.", {
  status: unauthenticated.response.status,
});
pass("Ledger lifecycle endpoint requires auth.");

if (!sessionToken) fail("QA_ADMIN_SESSION_TOKEN is required.");

const [summaryResult, eventsResult] = await Promise.all([
  requestJson("/api/authority/ledger-lifecycle/summary"),
  requestJson("/api/authority/ledger-lifecycle/events"),
]);

assert(summaryResult.response.status === 200 && summaryResult.body.success, "Lifecycle summary failed.", {
  status: summaryResult.response.status,
  body: summaryResult.body,
});
assert(eventsResult.response.status === 200 && eventsResult.body.success, "Lifecycle events failed.", {
  status: eventsResult.response.status,
  body: eventsResult.body,
});
assert(summaryResult.body.summary.domain === "LEDGER", "Ledger lifecycle summary domain mismatch.", {
  summary: summaryResult.body.summary,
});
assert(Array.isArray(eventsResult.body.lifecycleEvents.events), "Lifecycle events missing.", {
  body: eventsResult.body,
});

pass("Ledger lifecycle evidence reporting is available.", {
  totalEvents: summaryResult.body.summary.totalEvents,
  effectiveStatusCounts: summaryResult.body.summary.effectiveStatusCounts,
});
