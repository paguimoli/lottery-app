import "../qa/load-session-env.mjs";

const appUrl = process.env.OPS_APP_URL || process.env.QA_APP_URL || "http://localhost:3000";
const sessionToken =
  process.env.OPS_ADMIN_SESSION_TOKEN || process.env.QA_ADMIN_SESSION_TOKEN;
const correlationIdArg = process.argv.find((arg) =>
  arg.startsWith("--correlation-id=")
);
const correlationId = correlationIdArg?.split("=")[1] || null;

if (!sessionToken) {
  console.error("OPS_ADMIN_SESSION_TOKEN or QA_ADMIN_SESSION_TOKEN is required.");
  process.exit(1);
}

const response = await fetch(`${appUrl}/api/authority/promotion/simulate`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${sessionToken}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    domain: "SETTLEMENT",
    correlationId,
  }),
});
const payload = await response.json().catch(() => ({}));

if (!response.ok || !payload.success) {
  console.error(
    JSON.stringify({ status: "FAIL", statusCode: response.status, payload }, null, 2)
  );
  process.exit(1);
}

const simulation = payload.simulation;

console.log(
  JSON.stringify(
    {
      status: "PASS",
      domain: simulation.domain,
      promotionAllowed: simulation.promotionAllowed,
      currentAuthority: simulation.currentAuthority,
      proposedAuthority: simulation.proposedAuthority,
      comparisonMode: simulation.comparisonMode,
      rollbackReadiness: simulation.rollbackReadiness,
      blockers: simulation.blockers,
      warnings: simulation.warnings,
      auditEvent: simulation.auditEvent,
      simulatedAt: simulation.simulatedAt,
    },
    null,
    2
  )
);
