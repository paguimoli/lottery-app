import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const appUrl = process.env.QA_APP_URL || "http://localhost:3000";
const sessionToken = process.env.QA_ADMIN_SESSION_TOKEN;
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const correlationId = `qa-financial-audit-${Date.now()}`;
const assertions = [];

function fail(message, metadata = {}) {
  console.error("QA assertion failed.");
  console.error(`correlationId: ${correlationId}`);
  console.error(`reason: ${message}`);

  for (const [key, value] of Object.entries(metadata)) {
    console.error(`${key}: ${value}`);
  }

  process.exit(1);
}

function pass(message) {
  assertions.push(message);
  console.log(`PASS: ${message}`);
}

function supabase() {
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

async function requestJson(path) {
  const response = await fetch(`${appUrl}${path}`, {
    headers: {
      authorization: `Bearer ${sessionToken}`,
      "x-correlation-id": correlationId,
    },
  });
  const payload = await response.json().catch(() => ({}));

  return { response, payload };
}

async function queryLatest(table, select, notNullColumn = null) {
  let query = supabase().from(table).select(select).order("created_at", {
    ascending: false,
  });

  if (notNullColumn) query = query.not(notNullColumn, "is", null);

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    return null;
  }

  return data;
}

async function assertTrail(
  path,
  label,
  { requireCorrelation = true, requireSource = true } = {}
) {
  const { response, payload } = await requestJson(path);

  if (!response.ok || !payload.success) {
    fail(`${label} audit API failed.`, {
      status: response.status,
      error: payload.error ?? payload.errors?.join(" ") ?? "",
    });
  }

  const trail = payload.trail;
  const failGaps = trail.gaps.filter((gap) => gap.severity === "FAIL");

  if (failGaps.length > 0) {
    fail(`${label} audit trail has failing gaps.`, {
      gaps: failGaps.map((gap) => gap.code).join(","),
    });
  }

  if (requireSource && trail.sourceRecords.length === 0) {
    fail(`${label} audit trail has no source records.`);
  }

  if (trail.outboxEvents.length === 0) {
    fail(`${label} audit trail has no outbox events.`);
  }

  if (requireCorrelation && trail.correlationIds.length === 0) {
    fail(`${label} audit trail has no correlation id.`);
  }

  pass(`${label} audit trail reconstructable enough for review.`);
  return trail;
}

async function main() {
  if (!sessionToken) fail("QA_ADMIN_SESSION_TOKEN is required.");
  if (!supabaseUrl || !serviceRoleKey) {
    fail("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const settlement = await queryLatest(
    "credit_settlement_applications",
    "id, reservation_id, ticket_id, correlation_id, created_at"
  );

  if (settlement?.ticket_id) {
    await assertTrail(`/api/audit/ticket/${settlement.ticket_id}`, "ticket placement");
  } else {
    console.log("SKIP: no settlement-backed ticket found.");
  }

  if (settlement?.reservation_id) {
    await assertTrail(
      `/api/audit/reservation/${settlement.reservation_id}`,
      "reservation and settlement"
    );
  } else {
    console.log("SKIP: no reservation found.");
  }

  const accounting = await queryLatest(
    "weekly_accounting_snapshots",
    "id, week_start, week_end, currency, created_at"
  );

  if (accounting?.week_start && accounting?.week_end) {
    const params = new URLSearchParams({
      weekStart: accounting.week_start,
      weekEnd: accounting.week_end,
      currency: accounting.currency,
    });
    await assertTrail(`/api/audit/accounting/week?${params.toString()}`, "accounting");
  } else {
    console.log("SKIP: no weekly accounting snapshot found.");
  }

  const commissionRun = await queryLatest(
    "commission_runs",
    "id, correlation_id, created_at"
  );

  if (commissionRun?.id) {
    await assertTrail(
      `/api/audit/commission-run/${commissionRun.id}`,
      "commission run"
    );
  } else {
    console.log("SKIP: no commission run found.");
  }

  const reconciliationOutbox = await queryLatest(
    "outbox_events",
    "id, aggregate_id, event_type, correlation_id, created_at",
    "correlation_id"
  );

  if (reconciliationOutbox?.correlation_id) {
    await assertTrail(
      `/api/audit/correlation/${encodeURIComponent(
        reconciliationOutbox.correlation_id
      )}`,
      "correlation",
      { requireCorrelation: true, requireSource: false }
    );
  } else {
    console.log("SKIP: no correlated outbox event found.");
  }

  console.log(`correlationId: ${correlationId}`);
  console.log(`assertionsPassed: ${assertions.length}`);

  if (assertions.length === 0) {
    fail("No financial audit trails were available to validate.");
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : "Financial audit completeness QA failed.");
});
