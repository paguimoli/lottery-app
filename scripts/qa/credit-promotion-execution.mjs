import "./load-session-env.mjs";

const appUrl = process.env.QA_APP_URL || "http://localhost:3000";
const sessionToken = process.env.QA_ADMIN_SESSION_TOKEN;
const correlationId = "qa-credit-promotion-execution-v1";
const justification =
  "QA confirms Credit controlled promotion execution support is ready and rollback remains available.";

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
  if (!sessionToken) fail("QA_ADMIN_SESSION_TOKEN is required.");

  return {
    authorization: `Bearer ${sessionToken}`,
    ...extra,
  };
}

async function authGet(path) {
  return requestJson(path, { headers: authHeaders() });
}

async function executePromotion(body, authenticated = true) {
  return requestJson("/api/authority/credit-promotion/execute", {
    method: "POST",
    headers: authenticated
      ? authHeaders({ "content-type": "application/json" })
      : { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const unauthenticated = await executePromotion(
  {
    domain: "CREDIT",
    mode: "EXECUTE",
    justification,
    correlationId,
  },
  false
);
assert(unauthenticated.response.status === 401, "Credit promotion execution should require auth.", {
  status: unauthenticated.response.status,
  body: unauthenticated.body,
});
pass("Credit promotion execution endpoint requires auth.");

const invalidMode = await executePromotion({
  domain: "CREDIT",
  mode: "SIMULATION",
  justification,
  correlationId: `${correlationId}-invalid-mode`,
});
assert(invalidMode.response.status >= 400, "Credit promotion should reject invalid mode.", {
  status: invalidMode.response.status,
  body: invalidMode.body,
});
pass("Credit promotion execution rejects invalid mode.");

const missingJustification = await executePromotion({
  domain: "CREDIT",
  mode: "EXECUTE",
  justification: "",
  correlationId: `${correlationId}-missing-justification`,
});
assert(
  missingJustification.response.status >= 400,
  "Credit promotion should reject missing justification.",
  { status: missingJustification.response.status, body: missingJustification.body }
);
pass("Credit promotion execution rejects missing justification.");

const [
  authorityBeforeResult,
  decisionBeforeResult,
  settlementBeforeResult,
  ledgerBeforeResult,
] = await Promise.all([
  authGet("/api/authority/status"),
  authGet("/api/authority/promotion-decision?domain=credit"),
  authGet("/api/authority/settlement-stabilization-status?window=7d"),
  authGet("/api/authority/ledger-stabilization-status"),
]);
assert(authorityBeforeResult.response.status === 200 && authorityBeforeResult.body.success, "Authority before promotion failed.", {
  status: authorityBeforeResult.response.status,
  body: authorityBeforeResult.body,
});
assert(
  decisionBeforeResult.response.status === 200 && decisionBeforeResult.body.success,
  "Credit decision before promotion failed.",
  { status: decisionBeforeResult.response.status, body: decisionBeforeResult.body }
);
assert(
  settlementBeforeResult.response.status === 200 &&
    settlementBeforeResult.body.success,
  "Settlement status before Credit promotion failed.",
  { status: settlementBeforeResult.response.status, body: settlementBeforeResult.body }
);
assert(
  ledgerBeforeResult.response.status === 200 && ledgerBeforeResult.body.success,
  "Ledger status before Credit promotion failed.",
  { status: ledgerBeforeResult.response.status, body: ledgerBeforeResult.body }
);

const authorityBefore = authorityBeforeResult.body.authority;
const decisionBefore = decisionBeforeResult.body.decision;
const settlementBefore = settlementBeforeResult.body.stabilizationStatus;
const ledgerBefore = ledgerBeforeResult.body.stabilizationStatus;
assert(authorityBefore.settlement.authority === "SERVICE", "Settlement must be SERVICE before Credit promotion.", {
  authorityBefore,
});
assert(settlementBefore.certificationStatus === "CERTIFIED", "Settlement must be CERTIFIED before Credit promotion.", {
  settlementBefore,
});
assert(authorityBefore.ledger.authority === "SERVICE", "Ledger must be SERVICE before Credit promotion.", {
  authorityBefore,
});
assert(ledgerBefore.certificationStatus === "CERTIFIED", "Ledger must be CERTIFIED before Credit promotion.", {
  ledgerBefore,
});
assert(
  authorityBefore.credit.authority === "MONOLITH" ||
    authorityBefore.credit.authority === "SERVICE",
  "Credit authority must be a supported state before promotion.",
  { authorityBefore }
);
assert(
  decisionBefore.decision === "READY_FOR_CONTROLLED_PROMOTION" ||
    decisionBefore.decision === "PROMOTED",
  "Credit must be ready for controlled promotion or already promoted.",
  { decisionBefore }
);

const promotionResult = await executePromotion({
  domain: "CREDIT",
  mode: "EXECUTE",
  justification,
  correlationId,
});
assert(
  promotionResult.response.status === 200 && promotionResult.body.success,
  "Credit promotion execution failed.",
  { status: promotionResult.response.status, body: promotionResult.body }
);
const promotion = promotionResult.body.promotion;
assert(promotion.newAuthority === "SERVICE", "Credit promotion did not result in SERVICE authority.", {
  promotion,
});
assert(promotion.comparisonMode === "ENABLED", "Credit comparison must remain ENABLED.", {
  promotion,
});
assert(
  promotion.idempotent === true ||
    promotion.auditEvent?.eventType === "authority.credit.promoted",
  "Credit promotion event was not emitted for a new promotion.",
  { promotion }
);
pass("Credit promotion execution succeeds when valid.", {
  previousAuthority: promotion.previousAuthority,
  newAuthority: promotion.newAuthority,
  idempotent: promotion.idempotent,
  auditEvent: promotion.auditEvent,
});

const repeatedPromotion = await executePromotion({
  domain: "CREDIT",
  mode: "EXECUTE",
  justification,
  correlationId,
});
assert(
  repeatedPromotion.response.status === 200 && repeatedPromotion.body.success,
  "Repeated Credit promotion should be idempotent.",
  { status: repeatedPromotion.response.status, body: repeatedPromotion.body }
);
assert(
  repeatedPromotion.body.promotion.newAuthority === "SERVICE" &&
    repeatedPromotion.body.promotion.idempotent === true,
  "Repeated Credit promotion should report idempotent SERVICE authority.",
  { promotion: repeatedPromotion.body.promotion }
);
pass("Credit promotion execution is idempotent.");

const [
  authorityAfterResult,
  promotionStatusResult,
  rollbackReadinessResult,
  settlementStatusResult,
  ledgerStatusResult,
  decisionAfterResult,
] = await Promise.all([
  authGet("/api/authority/status"),
  authGet("/api/authority/credit-promotion-status"),
  authGet("/api/authority/rollback-readiness"),
  authGet("/api/authority/settlement-stabilization-status?window=7d"),
  authGet("/api/authority/ledger-stabilization-status"),
  authGet("/api/authority/promotion-decision?domain=credit"),
]);

assert(authorityAfterResult.response.status === 200 && authorityAfterResult.body.success, "Authority after promotion failed.", {
  status: authorityAfterResult.response.status,
  body: authorityAfterResult.body,
});
assert(
  promotionStatusResult.response.status === 200 && promotionStatusResult.body.success,
  "Credit promotion status failed.",
  { status: promotionStatusResult.response.status, body: promotionStatusResult.body }
);
assert(
  rollbackReadinessResult.response.status === 200 && rollbackReadinessResult.body.success,
  "Rollback readiness failed.",
  { status: rollbackReadinessResult.response.status, body: rollbackReadinessResult.body }
);
assert(
  settlementStatusResult.response.status === 200 && settlementStatusResult.body.success,
  "Settlement certification status failed.",
  { status: settlementStatusResult.response.status, body: settlementStatusResult.body }
);
assert(
  ledgerStatusResult.response.status === 200 && ledgerStatusResult.body.success,
  "Ledger certification status failed.",
  { status: ledgerStatusResult.response.status, body: ledgerStatusResult.body }
);
assert(
  decisionAfterResult.response.status === 200 && decisionAfterResult.body.success,
  "Credit decision after promotion failed.",
  { status: decisionAfterResult.response.status, body: decisionAfterResult.body }
);

const authorityAfter = authorityAfterResult.body.authority;
const promotionStatus = promotionStatusResult.body.promotionStatus;
const rollbackReadiness = rollbackReadinessResult.body.rollbackReadiness;
const settlementStatus = settlementStatusResult.body.stabilizationStatus;
const ledgerStatus = ledgerStatusResult.body.stabilizationStatus;
const decisionAfter = decisionAfterResult.body.decision;

assert(authorityAfter.credit.authority === "SERVICE", "Credit authority should be SERVICE.", {
  authorityAfter,
});
assert(authorityAfter.credit.comparisonMode === "ENABLED", "Credit comparison changed.", {
  authorityAfter,
});
assert(authorityAfter.settlement.authority === "SERVICE", "Settlement authority changed.", {
  authorityAfter,
});
assert(settlementStatus.certificationStatus === "CERTIFIED", "Settlement certification changed.", {
  settlementStatus,
});
assert(authorityAfter.ledger.authority === "SERVICE", "Ledger authority changed.", {
  authorityAfter,
});
assert(ledgerStatus.certificationStatus === "CERTIFIED", "Ledger certification changed.", {
  ledgerStatus,
});
assert(promotionStatus.authority === "SERVICE", "Credit promotion status should report SERVICE.", {
  promotionStatus,
});
assert(promotionStatus.rollbackReady === true, "Credit promotion status should report rollback ready.", {
  promotionStatus,
});
assert(
  rollbackReadiness.credit.rollbackStatus === "READY",
  "Credit rollback readiness should remain READY.",
  { rollbackReadiness: rollbackReadiness.credit }
);
assert(decisionAfter.decision === "PROMOTED", "Credit decision should be PROMOTED after execution.", {
  decisionAfter,
});

pass("Credit promotion execution QA completed.", {
  before: authorityBefore.credit.authority,
  after: authorityAfter.credit.authority,
  decisionBefore: decisionBefore.decision,
  decisionAfter: decisionAfter.decision,
  promotionEvent: promotion.auditEvent,
  rollbackReadiness: rollbackReadiness.credit.rollbackStatus,
});
