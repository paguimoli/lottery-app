const appUrl = process.env.OPS_APP_URL || process.env.QA_APP_URL || "http://localhost:3000";
const sessionToken =
  process.env.OPS_ADMIN_SESSION_TOKEN || process.env.QA_ADMIN_SESSION_TOKEN;

function getArgValue(args, name) {
  const index = args.indexOf(name);

  if (index < 0) return null;
  return args[index + 1] || null;
}

function parseArgs(args) {
  return {
    correlationId: getArgValue(args, "--correlationId"),
    ticketId: getArgValue(args, "--ticketId"),
    reservationId: getArgValue(args, "--reservationId"),
    ledgerTransactionId: getArgValue(args, "--ledgerTransactionId"),
    commissionRunId: getArgValue(args, "--commissionRunId"),
    weekStart: getArgValue(args, "--weekStart"),
    weekEnd: getArgValue(args, "--weekEnd"),
    currency: getArgValue(args, "--currency"),
  };
}

function fail(message, metadata = {}) {
  console.error("FAIL");
  console.error(message);

  for (const [key, value] of Object.entries(metadata)) {
    if (value !== null && value !== undefined) console.error(`${key}: ${value}`);
  }

  process.exit(1);
}

async function requestJson(path) {
  const response = await fetch(`${appUrl}${path}`, {
    headers: {
      authorization: `Bearer ${sessionToken}`,
      "content-type": "application/json",
    },
  });
  const payload = await response.json().catch(() => ({}));

  return { response, payload };
}

function resolvePath(input) {
  if (input.correlationId) {
    return `/api/audit/correlation/${encodeURIComponent(input.correlationId)}`;
  }

  if (input.ticketId) {
    return `/api/audit/ticket/${encodeURIComponent(input.ticketId)}`;
  }

  if (input.reservationId) {
    return `/api/audit/reservation/${encodeURIComponent(input.reservationId)}`;
  }

  if (input.ledgerTransactionId) {
    return `/api/audit/ledger/${encodeURIComponent(input.ledgerTransactionId)}`;
  }

  if (input.commissionRunId) {
    return `/api/audit/commission-run/${encodeURIComponent(input.commissionRunId)}`;
  }

  if (input.weekStart && input.weekEnd) {
    const params = new URLSearchParams({
      weekStart: input.weekStart,
      weekEnd: input.weekEnd,
    });

    if (input.currency) params.set("currency", input.currency);

    return `/api/audit/accounting/week?${params.toString()}`;
  }

  return null;
}

async function main() {
  if (!sessionToken) {
    fail("OPS_ADMIN_SESSION_TOKEN or QA_ADMIN_SESSION_TOKEN is required.");
  }

  const path = resolvePath(parseArgs(process.argv.slice(2)));

  if (!path) {
    fail(
      "Provide one of --correlationId, --ticketId, --reservationId, --ledgerTransactionId, --commissionRunId, or --weekStart/--weekEnd."
    );
  }

  const { response, payload } = await requestJson(path);

  if (!response.ok || !payload.success) {
    fail("Audit API request failed.", {
      status: response.status,
      error: payload.error ?? payload.errors?.join(" ") ?? "Unknown error",
    });
  }

  const trail = payload.trail;
  const failingGaps = trail.gaps.filter((gap) => gap.severity === "FAIL");

  console.log(failingGaps.length === 0 ? "PASS" : "FAIL");
  console.log(`queryType: ${trail.queryType}`);
  console.log(`queryId: ${trail.queryId}`);
  console.log(`reconstructable: ${trail.reconstructable}`);
  console.log(`sourceRecords: ${trail.sourceRecords.length}`);
  console.log(`authAuditEvents: ${trail.authAuditEvents.length}`);
  console.log(`outboxEvents: ${trail.outboxEvents.length}`);
  console.log(`correlationIds: ${trail.correlationIds.join(",")}`);

  if (trail.gaps.length > 0) {
    console.log("gaps:");

    for (const gap of trail.gaps) {
      console.log(`${gap.severity} ${gap.code} ${gap.message}`);
    }
  }

  if (failingGaps.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : "Audit correlation check failed.");
});
