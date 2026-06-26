import "./load-session-env.mjs";

const appUrl = process.env.QA_APP_URL || "http://localhost:3000";
const sessionToken = process.env.QA_ADMIN_SESSION_TOKEN;
const correlationId = `qa-ledger-rollback-drill-${Date.now()}`;

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
  if (!sessionToken) {
    fail("QA_ADMIN_SESSION_TOKEN is required.");
  }

  return {
    authorization: `Bearer ${sessionToken}`,
    ...extra,
  };
}

const protectedPaths = [
  {
    path: "/api/authority/ledger-post-promotion-status",
    method: "GET",
  },
  {
    path: "/api/authority/ledger-rollback/drill",
    method: "POST",
    body: { mode: "SIMULATION" },
  },
];

for (const protectedPath of protectedPaths) {
  const unauthenticated = await requestJson(protectedPath.path, {
    method: protectedPath.method,
    headers:
      protectedPath.method === "POST"
        ? { "content-type": "application/json" }
        : undefined,
    body: protectedPath.body ? JSON.stringify(protectedPath.body) : undefined,
  });

  assert(
    unauthenticated.response.status === 401,
    "Ledger post-promotion authority API should require authentication.",
    {
      path: protectedPath.path,
      status: unauthenticated.response.status,
      body: unauthenticated.body,
    }
  );
}
pass("Ledger post-promotion monitoring and rollback drill APIs require auth.");

const [authorityBefore, postPromotionStatus] = await Promise.all([
  requestJson("/api/authority/status", { headers: authHeaders() }),
  requestJson("/api/authority/ledger-post-promotion-status", {
    headers: authHeaders(),
  }),
]);

assert(
  authorityBefore.response.status === 200 && authorityBefore.body.success,
  "Authority status endpoint failed before Ledger rollback drill.",
  { status: authorityBefore.response.status, body: authorityBefore.body }
);
const authority = authorityBefore.body.authority;
assert(authority.settlement.authority === "SERVICE", "Settlement must remain SERVICE.", {
  authority,
});
assert(authority.ledger.authority === "SERVICE", "Ledger must be SERVICE.", {
  authority,
});
assert(
  authority.ledger.comparisonMode === "ENABLED",
  "Ledger comparison mode must remain ENABLED.",
  { authority }
);
assert(
  authority.credit.authority === "MONOLITH" || authority.credit.authority === "SERVICE",
  "Credit authority has an unsupported value.",
  { authority }
);
pass("Authority state is Ledger post-promotion safe.", {
  settlement: authority.settlement.authority,
  ledger: authority.ledger.authority,
  credit: authority.credit.authority,
});

const certification = await requestJson(
  "/api/authority/settlement-stabilization-status",
  { headers: authHeaders() }
);
assert(
  certification.response.status === 200 && certification.body.success,
  "Settlement certification status endpoint failed.",
  { status: certification.response.status, body: certification.body }
);
assert(
  certification.body.stabilizationStatus.certificationStatus === "CERTIFIED",
  "Settlement certification must remain CERTIFIED.",
  { stabilizationStatus: certification.body.stabilizationStatus }
);
pass("Settlement certification remains intact.", {
  certificationStatus:
    certification.body.stabilizationStatus.certificationStatus,
});

assert(
  postPromotionStatus.response.status === 200 &&
    postPromotionStatus.body.success,
  "Ledger post-promotion status endpoint failed.",
  {
    status: postPromotionStatus.response.status,
    body: postPromotionStatus.body,
  }
);
const monitoring = postPromotionStatus.body.postPromotionStatus;
assert(monitoring.authority === "SERVICE", "Ledger monitoring authority mismatch.", {
  monitoring,
});
assert(
  monitoring.comparisonMode === "ENABLED",
  "Ledger monitoring comparison mode mismatch.",
  { monitoring }
);
assert(monitoring.promotedAt, "Ledger promotion timestamp missing.", { monitoring });
assert(
  monitoring.serviceHealth.available === true,
  "Ledger Service health should be available.",
  { monitoring }
);
assert(
  monitoring.rollbackReadiness === "READY",
  "Ledger rollback readiness should be READY.",
  { monitoring }
);
assert(
  typeof monitoring.postPromotionMismatchCount === "number" &&
    typeof monitoring.postPromotionFailureCount === "number",
  "Ledger post-promotion counts missing.",
  { monitoring }
);
assert(monitoring.recommendation, "Ledger monitoring recommendation missing.", {
  monitoring,
});
pass("Ledger post-promotion monitoring endpoint reports required controls.", {
  promotedAt: monitoring.promotedAt,
  mismatchCount: monitoring.postPromotionMismatchCount,
  failureCount: monitoring.postPromotionFailureCount,
  recommendation: monitoring.recommendation,
});

const drill = await requestJson("/api/authority/ledger-rollback/drill", {
  method: "POST",
  headers: authHeaders({ "content-type": "application/json" }),
  body: JSON.stringify({
    mode: "SIMULATION",
    correlationId,
  }),
});
assert(
  drill.response.status === 200 && drill.body.success,
  "Ledger rollback drill simulation failed.",
  { status: drill.response.status, body: drill.body }
);
const drillResult = drill.body.drill;
assert(drillResult.drillPassed === true, "Ledger rollback drill should pass.", {
  drill: drillResult,
});
assert(
  drillResult.authorityBefore === "SERVICE" &&
    drillResult.authorityAfter === "SERVICE",
  "Ledger rollback drill must not change authority.",
  { drill: drillResult }
);
assert(
  drillResult.authorityChanged === false,
  "Ledger rollback drill reported authority mutation.",
  { drill: drillResult }
);
assert(
  drillResult.auditEvent?.eventType ===
    "authority.ledger.rollback.drill.simulated",
  "Ledger rollback drill outbox event missing.",
  { drill: drillResult }
);
pass("Ledger rollback drill simulation passed without authority change.", {
  auditEvent: drillResult.auditEvent,
});

const authorityAfter = await requestJson("/api/authority/status", {
  headers: authHeaders(),
});
assert(
  authorityAfter.response.status === 200 && authorityAfter.body.success,
  "Authority status endpoint failed after Ledger rollback drill.",
  { status: authorityAfter.response.status, body: authorityAfter.body }
);
assert(
    authorityAfter.body.authority.settlement.authority === "SERVICE" &&
    authorityAfter.body.authority.ledger.authority === "SERVICE" &&
    authorityAfter.body.authority.ledger.comparisonMode === "ENABLED" &&
    (authorityAfter.body.authority.credit.authority === "MONOLITH" ||
      authorityAfter.body.authority.credit.authority === "SERVICE") &&
    authorityAfter.body.authority.credit.comparisonMode === "ENABLED",
  "Ledger rollback drill changed authority controls.",
  { authority: authorityAfter.body.authority }
);
pass("Ledger rollback drill left authority controls unchanged.", {
  ledger: authorityAfter.body.authority.ledger.authority,
  comparisonMode: authorityAfter.body.authority.ledger.comparisonMode,
});

pass("Ledger post-promotion QA completed.", {
  correlationId,
  recommendation: monitoring.recommendation,
});
