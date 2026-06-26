import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import "./load-session-env.mjs";

const appUrl = process.env.QA_APP_URL || "http://localhost:3000";
const sessionToken = process.env.QA_ADMIN_SESSION_TOKEN;
const dryRunCorrelationId = "qa-credit-dry-run-approval-v1";
const promotionCorrelationId = "qa-credit-promotion-approval-v1";
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

async function approveDryRun(warnings) {
  return requestJson("/api/authority/approvals/dry-run", {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({
      domain: "CREDIT",
      justification:
        "QA confirms Credit dry-run approval exists before promotion approval.",
      acknowledgedWarnings: warnings,
      correlationId: dryRunCorrelationId,
    }),
  });
}

async function approvePromotion(body) {
  return requestJson("/api/authority/approvals/promotion", {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(body),
  });
}

function promotionApprovals(history) {
  return history.approvals.filter(
    (approval) =>
      approval.authorityCandidate === "CREDIT" &&
      approval.approvalType === "PROMOTION_APPROVAL"
  );
}

function createQaSupabaseClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    fail("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      transport: WebSocket,
    },
  });
}

async function assertOutboxEvent({ approvalId, correlationId }) {
  const supabase = createQaSupabaseClient();
  const { data, error } = await supabase
    .from("outbox_events")
    .select("id,event_type,aggregate_type,aggregate_id,payload,correlation_id")
    .eq("event_type", "authority.credit.promotion.approved")
    .eq("aggregate_type", "authority_candidate")
    .eq("aggregate_id", "CREDIT")
    .eq("correlation_id", correlationId)
    .limit(10);

  if (error) {
    fail("Unable to query Credit promotion approval outbox event.", {
      error: error.message,
    });
  }

  const event = data?.find(
    (candidate) => candidate.payload?.approvalId === approvalId
  );

  assert(Boolean(event), "Credit promotion approval outbox event was not found.", {
    approvalId,
    correlationId,
    events: data,
  });

  pass("Credit promotion approval outbox event exists.", {
    outboxEventId: event.id,
    approvalId,
  });
}

const unauthenticated = await requestJson("/api/authority/approvals/promotion", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    domain: "CREDIT",
    justification: "Unauthenticated Credit approval should fail.",
    acknowledgedWarnings: [],
  }),
});
assert(
  unauthenticated.response.status === 401,
  "Credit promotion approval should require auth.",
  { status: unauthenticated.response.status, body: unauthenticated.body }
);
pass("Credit promotion approval endpoint requires auth.");

const [
  initialDecisionResult,
  authorityResult,
  settlementStatusResult,
  ledgerStatusResult,
  historyBeforeResult,
] = await Promise.all([
  authGet("/api/authority/promotion-decision?domain=credit"),
  authGet("/api/authority/status"),
  authGet("/api/authority/settlement-stabilization-status?window=7d"),
  authGet("/api/authority/ledger-stabilization-status"),
  authGet("/api/authority/credit-approval-history"),
]);

assert(
  initialDecisionResult.response.status === 200 && initialDecisionResult.body.success,
  "Credit promotion decision lookup failed.",
  { status: initialDecisionResult.response.status, body: initialDecisionResult.body }
);
assert(authorityResult.response.status === 200 && authorityResult.body.success, "Authority status failed.", {
  status: authorityResult.response.status,
  body: authorityResult.body,
});
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
  historyBeforeResult.response.status === 200 && historyBeforeResult.body.success,
  "Credit approval history before approval failed.",
  { status: historyBeforeResult.response.status, body: historyBeforeResult.body }
);

const initialDecision = initialDecisionResult.body.decision;
const authorityBefore = authorityResult.body.authority;
const settlementStatus = settlementStatusResult.body.stabilizationStatus;
const ledgerStatus = ledgerStatusResult.body.stabilizationStatus;
const beforePromotionApprovals = promotionApprovals(
  historyBeforeResult.body.approvalHistory
);

assert(initialDecision.domain === "CREDIT", "Credit decision domain mismatch.", {
  initialDecision,
});
assert(initialDecision.currentAuthority === "MONOLITH", "Credit authority must remain MONOLITH before approval.", {
  initialDecision,
});
assert(initialDecision.comparisonMode === "ENABLED", "Credit comparison must remain ENABLED before approval.", {
  initialDecision,
});
assert(initialDecision.rollbackReadiness === "READY", "Credit rollback readiness must be READY before approval.", {
  initialDecision,
});
assert(authorityBefore.credit.authority === "MONOLITH", "Credit authority status must remain MONOLITH.", {
  authorityBefore,
});
assert(authorityBefore.credit.comparisonMode === "ENABLED", "Credit comparison status must remain ENABLED.", {
  authorityBefore,
});
assert(authorityBefore.settlement.authority === "SERVICE", "Settlement must remain SERVICE.", {
  authorityBefore,
});
assert(settlementStatus.certificationStatus === "CERTIFIED", "Settlement must remain CERTIFIED.", {
  settlementStatus,
});
assert(authorityBefore.ledger.authority === "SERVICE", "Ledger must remain SERVICE.", {
  authorityBefore,
});
assert(ledgerStatus.certificationStatus === "CERTIFIED", "Ledger must remain CERTIFIED.", {
  ledgerStatus,
});

const missingJustification = await approvePromotion({
  domain: "CREDIT",
  justification: "",
  acknowledgedWarnings: initialDecision.warnings,
});
assert(
  missingJustification.response.status >= 400,
  "Credit promotion approval should reject missing justification.",
  { status: missingJustification.response.status, body: missingJustification.body }
);
pass("Credit promotion approval rejects missing justification.");

if (initialDecision.decision === "READY_FOR_PROMOTION_APPROVAL") {
  const missingWarningAcknowledgement = await approvePromotion({
    domain: "CREDIT",
    justification: "QA validates Credit missing warning acknowledgement rejection.",
    acknowledgedWarnings: [],
  });
  assert(
    missingWarningAcknowledgement.response.status >= 400,
    "Credit promotion approval should reject missing warning acknowledgement.",
    {
      status: missingWarningAcknowledgement.response.status,
      body: missingWarningAcknowledgement.body,
    }
  );
  pass("Credit promotion approval rejects missing warning acknowledgement.");
} else {
  assert(
    initialDecision.decision === "READY_FOR_CONTROLLED_PROMOTION",
    "Credit decision must be ready for promotion approval or already promotion-approved.",
    { initialDecision }
  );
  pass("Credit warning acknowledgement rejection already covered by existing approval state.", {
    decision: initialDecision.decision,
  });
}

const dryRunApproval = await approveDryRun(initialDecision.warnings);
assert(
  dryRunApproval.response.status === 200 && dryRunApproval.body.success,
  "Credit DRY_RUN_APPROVAL prerequisite should exist.",
  { status: dryRunApproval.response.status, body: dryRunApproval.body }
);
assert(
  dryRunApproval.body.approval.approvalType === "DRY_RUN_APPROVAL",
  "Credit DRY_RUN_APPROVAL prerequisite type mismatch.",
  { approval: dryRunApproval.body.approval }
);
assert(
  dryRunApproval.body.approval.authorityCandidate === "CREDIT",
  "Credit DRY_RUN_APPROVAL prerequisite domain mismatch.",
  { approval: dryRunApproval.body.approval }
);
pass("Credit DRY_RUN_APPROVAL prerequisite is enforced and available.", {
  approvalId: dryRunApproval.body.approval.id,
  idempotent: dryRunApproval.body.idempotent,
});

const decisionBeforeResult = await authGet("/api/authority/promotion-decision?domain=credit");
assert(
  decisionBeforeResult.response.status === 200 && decisionBeforeResult.body.success,
  "Credit promotion decision before promotion approval failed.",
  { status: decisionBeforeResult.response.status, body: decisionBeforeResult.body }
);
const decisionBefore = decisionBeforeResult.body.decision;
assert(
  decisionBefore.decision === "READY_FOR_PROMOTION_APPROVAL" ||
    decisionBefore.decision === "READY_FOR_CONTROLLED_PROMOTION",
  "Credit must be ready for promotion approval or already promotion-approved.",
  { decisionBefore }
);
assert(
  decisionBefore.approvalState.dryRunApproval,
  "Credit DRY_RUN_APPROVAL must exist before promotion approval.",
  { decisionBefore }
);

const validApproval = await approvePromotion({
  domain: "CREDIT",
  justification:
    "QA confirms Credit dry-run approval exists, rollback is ready, and controlled promotion may be planned.",
  acknowledgedWarnings: decisionBefore.warnings,
  correlationId: promotionCorrelationId,
});
assert(
  validApproval.response.status === 200 && validApproval.body.success,
  "Credit promotion approval failed.",
  { status: validApproval.response.status, body: validApproval.body }
);
assert(
  validApproval.body.approval.approvalType === "PROMOTION_APPROVAL",
  "Credit promotion approval type mismatch.",
  { approval: validApproval.body.approval }
);
assert(
  validApproval.body.approval.authorityCandidate === "CREDIT",
  "Credit promotion approval domain mismatch.",
  { approval: validApproval.body.approval }
);
pass("Credit promotion approval succeeds when valid.", {
  approvalId: validApproval.body.approval.id,
  idempotent: validApproval.body.idempotent,
});

const repeatedApproval = await approvePromotion({
  domain: "CREDIT",
  justification:
    "QA confirms Credit dry-run approval exists, rollback is ready, and controlled promotion may be planned.",
  acknowledgedWarnings: decisionBefore.warnings,
  correlationId: promotionCorrelationId,
});
assert(
  repeatedApproval.response.status === 200 && repeatedApproval.body.success,
  "Repeated Credit promotion approval should be idempotent.",
  { status: repeatedApproval.response.status, body: repeatedApproval.body }
);
assert(
  repeatedApproval.body.approval.id === validApproval.body.approval.id,
  "Repeated Credit promotion approval should return existing approval.",
  {
    firstApprovalId: validApproval.body.approval.id,
    repeatedApprovalId: repeatedApproval.body.approval.id,
  }
);
assert(repeatedApproval.body.idempotent === true, "Repeated Credit approval should be idempotent.", {
  body: repeatedApproval.body,
});

const historyAfterResult = await authGet("/api/authority/credit-approval-history");
assert(
  historyAfterResult.response.status === 200 && historyAfterResult.body.success,
  "Credit approval history after promotion approval failed.",
  { status: historyAfterResult.response.status, body: historyAfterResult.body }
);
const afterPromotionApprovals = promotionApprovals(
  historyAfterResult.body.approvalHistory
);
const matchingApprovals = afterPromotionApprovals.filter(
  (approval) => approval.id === validApproval.body.approval.id
);
assert(matchingApprovals.length === 1, "Credit promotion approval should be append-only and not duplicated.", {
  approvalId: validApproval.body.approval.id,
  beforeCount: beforePromotionApprovals.length,
  afterCount: afterPromotionApprovals.length,
});
pass("Credit promotion approval is idempotent and append-only.");

await assertOutboxEvent({
  approvalId: validApproval.body.approval.id,
  correlationId: promotionCorrelationId,
});

const [decisionAfterResult, authorityAfterResult, settlementAfterResult, ledgerAfterResult] =
  await Promise.all([
    authGet("/api/authority/promotion-decision?domain=credit"),
    authGet("/api/authority/status"),
    authGet("/api/authority/settlement-stabilization-status?window=7d"),
    authGet("/api/authority/ledger-stabilization-status"),
  ]);
assert(
  decisionAfterResult.response.status === 200 && decisionAfterResult.body.success,
  "Credit promotion decision after approval failed.",
  { status: decisionAfterResult.response.status, body: decisionAfterResult.body }
);
assert(authorityAfterResult.response.status === 200 && authorityAfterResult.body.success, "Authority after approval failed.", {
  status: authorityAfterResult.response.status,
  body: authorityAfterResult.body,
});
assert(
  settlementAfterResult.response.status === 200 && settlementAfterResult.body.success,
  "Settlement status after Credit approval failed.",
  { status: settlementAfterResult.response.status, body: settlementAfterResult.body }
);
assert(
  ledgerAfterResult.response.status === 200 && ledgerAfterResult.body.success,
  "Ledger status after Credit approval failed.",
  { status: ledgerAfterResult.response.status, body: ledgerAfterResult.body }
);

const decisionAfter = decisionAfterResult.body.decision;
const authorityAfter = authorityAfterResult.body.authority;
const settlementAfter = settlementAfterResult.body.stabilizationStatus;
const ledgerAfter = ledgerAfterResult.body.stabilizationStatus;

assert(
  decisionAfter.decision === "READY_FOR_CONTROLLED_PROMOTION",
  "Credit decision should advance to controlled promotion readiness.",
  { decisionBefore, decisionAfter }
);
assert(decisionAfter.currentAuthority === "MONOLITH", "Credit decision authority changed.", {
  decisionAfter,
});
assert(authorityAfter.credit.authority === "MONOLITH", "Credit authority changed.", {
  authorityAfter,
});
assert(authorityAfter.credit.comparisonMode === "ENABLED", "Credit comparison changed.", {
  authorityAfter,
});
assert(authorityAfter.settlement.authority === "SERVICE", "Settlement authority changed.", {
  authorityAfter,
});
assert(settlementAfter.certificationStatus === "CERTIFIED", "Settlement certification changed.", {
  settlementAfter,
});
assert(authorityAfter.ledger.authority === "SERVICE", "Ledger authority changed.", {
  authorityAfter,
});
assert(ledgerAfter.certificationStatus === "CERTIFIED", "Ledger certification changed.", {
  ledgerAfter,
});

pass("Credit promotion approval QA completed.", {
  approvalId: validApproval.body.approval.id,
  before: decisionBefore.decision,
  after: decisionAfter.decision,
  idempotent: validApproval.body.idempotent,
  authority: authorityAfter.credit.authority,
  comparisonMode: authorityAfter.credit.comparisonMode,
});
