import "./load-session-env.mjs";

const appUrl = process.env.QA_APP_URL || "http://localhost:3000";
const sessionToken = process.env.QA_ADMIN_SESSION_TOKEN;
const warning =
  "Operator certification is still required before marking Settlement as CERTIFIED.";
const correlationId = "qa-settlement-certification-capture";

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

async function getStabilizationStatus() {
  const result = await requestJson(
    "/api/authority/settlement-stabilization-status?window=7d",
    {
      headers: authHeaders(),
    }
  );

  assert(result.response.status === 200 && result.body.success, "Status failed.", {
    status: result.response.status,
    body: result.body,
  });

  return result.body.stabilizationStatus;
}

async function certify(body) {
  return requestJson("/api/authority/certification/settlement", {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(body),
  });
}

const unauthenticated = await requestJson("/api/authority/certification/settlement", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ justification: "Missing auth should fail." }),
});
assert(
  unauthenticated.response.status === 401,
  "Settlement certification endpoint should require auth.",
  { status: unauthenticated.response.status, body: unauthenticated.body }
);
pass("Settlement certification endpoint requires auth.");

const missingJustification = await certify({
  acknowledgedWarnings: [warning],
  correlationId: "qa-settlement-certification-missing-justification",
});
assert(
  missingJustification.response.status === 400,
  "Certification should reject missing justification.",
  { status: missingJustification.response.status, body: missingJustification.body }
);
pass("Settlement certification rejects missing justification.");

const before = await getStabilizationStatus();
assert(before.authority === "SERVICE", "Settlement authority must be SERVICE.", {
  before,
});
assert(before.comparisonMode === "ENABLED", "Comparison must remain ENABLED.", {
  before,
});
assert(before.rollbackReadiness === "READY", "Rollback readiness must be READY.", {
  before,
});
assert(
  before.certificationStatus === "READY_FOR_CERTIFICATION" ||
    before.certificationStatus === "CERTIFIED",
  "Settlement must be ready or already certified.",
  { before }
);

const approval = await certify({
  justification:
    "QA certifies Settlement Service stabilization evidence for controlled authority.",
  acknowledgedWarnings: [warning],
  correlationId,
});
assert(approval.response.status === 200 && approval.body.success, "Certification failed.", {
  status: approval.response.status,
  body: approval.body,
});
assert(
  approval.body.approval.approvalType === "SETTLEMENT_CERTIFICATION",
  "Unexpected approval type.",
  { body: approval.body }
);
assert(
  approval.body.stabilizationAfter.certificationStatus === "CERTIFIED",
  "Certification should update status to CERTIFIED.",
  { body: approval.body }
);
pass("Settlement certification succeeds when valid.", {
  approvalId: approval.body.approval.id,
  idempotent: approval.body.idempotent,
});

const idempotent = await certify({
  justification:
    "QA certifies Settlement Service stabilization evidence for controlled authority.",
  acknowledgedWarnings: [warning],
  correlationId,
});
assert(
  idempotent.response.status === 200 &&
    idempotent.body.success &&
    idempotent.body.idempotent === true &&
    idempotent.body.approval.id === approval.body.approval.id,
  "Certification should be idempotent by correlationId.",
  { status: idempotent.response.status, body: idempotent.body }
);
pass("Settlement certification is idempotent.", {
  approvalId: idempotent.body.approval.id,
});

const after = await getStabilizationStatus();
assert(after.certificationStatus === "CERTIFIED", "Status should be CERTIFIED.", {
  after,
});
assert(after.certificationApprovalId === approval.body.approval.id, "Approval id missing.", {
  after,
  approval: approval.body.approval,
});
assert(after.certifiedAt, "Certified timestamp missing.", { after });
assert(after.authority === "SERVICE", "Certification changed authority.", { after });
assert(after.comparisonMode === "ENABLED", "Certification changed comparison mode.", {
  after,
});
assert(after.rollbackReadiness === "READY", "Certification changed rollback readiness.", {
  after,
});
pass("Settlement certification QA completed.", {
  before: before.certificationStatus,
  after: after.certificationStatus,
  approvalId: after.certificationApprovalId,
  certifiedAt: after.certifiedAt,
});
