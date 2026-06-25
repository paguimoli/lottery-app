import "../qa/load-session-env.mjs";

const appUrl = process.env.OPS_APP_URL || process.env.QA_APP_URL || "http://localhost:3000";
const sessionToken =
  process.env.OPS_ADMIN_SESSION_TOKEN || process.env.QA_ADMIN_SESSION_TOKEN;
const correlationId = `ops-credit-promotion-simulation-${Date.now()}`;

if (!sessionToken) {
  console.error("OPS_ADMIN_SESSION_TOKEN or QA_ADMIN_SESSION_TOKEN is required.");
  process.exit(1);
}

const response = await fetch(`${appUrl}/api/authority/credit-promotion/simulate`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${sessionToken}`,
  },
  body: JSON.stringify({ correlationId }),
});
const payload = await response.json().catch(() => ({}));

if (!response.ok || !payload.success) {
  console.error(
    JSON.stringify({ status: "FAIL", statusCode: response.status, payload }, null, 2)
  );
  process.exit(1);
}

console.log(JSON.stringify({ status: "PASS", simulation: payload.simulation }, null, 2));
