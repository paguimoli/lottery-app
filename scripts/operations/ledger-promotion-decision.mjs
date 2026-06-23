import "../qa/load-session-env.mjs";

const appUrl = process.env.OPS_APP_URL || process.env.QA_APP_URL || "http://localhost:3000";
const token = process.env.OPS_ADMIN_SESSION_TOKEN || process.env.QA_ADMIN_SESSION_TOKEN;

if (!token) {
  console.error("OPS_ADMIN_SESSION_TOKEN or QA_ADMIN_SESSION_TOKEN is required.");
  process.exit(1);
}

const response = await fetch(`${appUrl}/api/authority/promotion-decision?domain=ledger`, {
  headers: { authorization: `Bearer ${token}` },
});
const body = await response.json();

if (!response.ok || !body.success) {
  console.error(JSON.stringify({ status: response.status, body }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      domain: body.decision.domain,
      decision: body.decision.decision,
      authority: body.decision.currentAuthority,
      comparisonMode: body.decision.comparisonMode,
      rawReadiness: body.decision.rawReadiness,
      promotionReadiness: body.decision.promotionReadiness,
      blockers: body.decision.blockingReasons,
      warnings: body.decision.warnings,
      recommendation: body.decision.recommendation,
    },
    null,
    2
  )
);
