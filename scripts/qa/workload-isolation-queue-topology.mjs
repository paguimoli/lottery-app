import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const appUrl = process.env.QA_APP_URL || "http://localhost:3000";
const sessionToken =
  process.env.QA_ADMIN_SESSION_TOKEN || process.env.OPS_ADMIN_SESSION_TOKEN;
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const correlationId = `qa-workload-isolation-${Date.now()}`;
const assertions = [];
const projectRoot = process.cwd();

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

async function requestJson(pathname, options = {}) {
  const response = await fetch(`${appUrl}${pathname}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(sessionToken ? { authorization: `Bearer ${sessionToken}` } : {}),
      ...(options.headers ?? {}),
      "x-correlation-id": correlationId,
    },
  });
  const payload = await response.json().catch(() => ({}));

  return { response, payload };
}

async function querySingle(table, select, build = (query) => query) {
  const { data, error } = await build(
    supabase().from(table).select(select)
  ).limit(1).maybeSingle();

  if (error) {
    fail(`Unable to query ${table}.`, {
      code: error.code,
      message: error.message,
    });
  }

  return data;
}

async function getTicketPlacementPrerequisites() {
  const [{ data: profiles, error: profileError }, { data: players, error: playerError }] =
    await Promise.all([
      supabase()
        .from("player_profiles")
        .select("id, external_player_id, account_id")
        .not("external_player_id", "is", null)
        .limit(50),
      supabase()
        .from("players")
        .select("id, organization_id, external_player_id")
        .not("external_player_id", "is", null)
        .limit(50),
    ]);

  if (profileError) {
    fail("Unable to query player profiles.", {
      code: profileError.code,
      message: profileError.message,
    });
  }

  if (playerError) {
    fail("Unable to query players.", {
      code: playerError.code,
      message: playerError.message,
    });
  }

  const playersByExternalId = new Map(
    (players ?? []).map((player) => [player.external_player_id, player])
  );
  const profile = (profiles ?? []).find((item) =>
    playersByExternalId.has(item.external_player_id)
  );
  const player = profile
    ? playersByExternalId.get(profile.external_player_id)
    : null;

  if (!player) {
    fail("No profile-backed external player row exists for ticket placement QA.");
  }

  const organization = await querySingle(
    "organizations",
    "id, external_organization_id",
    (query) => query.eq("id", player.organization_id)
  );

  if (!organization?.external_organization_id) {
    fail("No external organization exists for ticket placement QA.", {
      organizationId: player.organization_id,
    });
  }

  const drawing = await querySingle(
    "normalized_drawings",
    "id, external_id",
    (query) => query.not("external_id", "is", null)
  );

  if (!drawing?.external_id) {
    fail("No normalized drawing exists for ticket placement QA.");
  }

  return { player, organization, drawing };
}

async function placeQaTicket() {
  const { player, organization, drawing } =
    await getTicketPlacementPrerequisites();
  const externalTicketId = `QA129-TICKET-${Date.now()}`;
  const { response, payload } = await requestJson("/api/tickets", {
    method: "POST",
    headers: {
      "Idempotency-Key": `qa129-ticket-${externalTicketId}`,
    },
    body: JSON.stringify({
      organizationExternalId: organization.external_organization_id,
      playerExternalId: player.external_player_id,
      drawingExternalId: drawing.external_id,
      externalTicketId,
      sourceType: "qa_workload_isolation",
      currency: "USD",
      legs: [
        {
          betType: "qa-workload-isolation",
          numbers: "01,02,03",
          amount: 100,
          stakeMode: "STRAIGHT",
          selectionMethod: "manual",
        },
      ],
    }),
  });

  if (!response.ok || payload.accepted !== true) {
    fail("QA ticket placement failed.", {
      status: response.status,
      error: payload.error ?? JSON.stringify(payload),
    });
  }

  pass("QA ticket placement succeeded.");
  return payload;
}

async function assertTicketAcceptedOutbox(ticketId) {
  const { data, error } = await supabase()
    .from("outbox_events")
    .select("id, event_type, aggregate_type, aggregate_id, payload, correlation_id")
    .eq("event_type", "ticket.accepted")
    .eq("aggregate_type", "ticket")
    .eq("aggregate_id", ticketId)
    .limit(1)
    .maybeSingle();

  if (error) {
    fail("Unable to query ticket.accepted outbox event.", {
      code: error.code,
      message: error.message,
    });
  }

  if (!data) {
    fail("ticket.accepted outbox event was not created.", { ticketId });
  }

  pass("ticket.accepted outbox event exists after QA ticket placement.");
  return data;
}

async function assertQueueHealthAndTopology() {
  if (!sessionToken) {
    fail("QA_ADMIN_SESSION_TOKEN or OPS_ADMIN_SESSION_TOKEN is required.");
  }

  const { response, payload } = await requestJson("/api/operations/queues/health");

  if (!response.ok || !payload.success) {
    fail("Queue health endpoint failed.", {
      status: response.status,
      error: payload.error ?? "unknown",
    });
  }

  const topology = payload.health.topology;
  const byCategory = new Map(topology.map((entry) => [entry.category, entry]));
  const expected = {
    TICKET_LIFECYCLE: "ticket.accepted",
    CRITICAL_FINANCIAL: "credit.settlement.applied",
    ACCOUNTING: "accounting.snapshot.generated",
    COMMISSION: "commission.run.completed",
    RECONCILIATION: "reconciliation.finding.resolved",
    OPERATIONAL_ACCESS: "session.revoked",
  };

  for (const [category, example] of Object.entries(expected)) {
    const entry = byCategory.get(category);

    if (!entry) {
      fail("Queue topology category missing.", { category });
    }

    if (!entry.examples.includes(example)) {
      fail("Queue topology example mapping missing.", { category, example });
    }
  }

  if (typeof payload.health.outbox.pendingCount !== "number") {
    fail("Queue health endpoint did not include outbox pending count.");
  }

  if (!Array.isArray(payload.health.rabbitmq) || payload.health.rabbitmq.length === 0) {
    fail("Queue health endpoint did not include RabbitMQ queues.");
  }

  pass("Queue health endpoint returned topology, outbox lag, and RabbitMQ data.");
}

function walkFiles(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === ".git" ||
      entry.name === ".next"
    ) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walkFiles(fullPath, files);
      continue;
    }

    if (/\.(ts|tsx|mjs|js)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function assertNoDirectRabbitMqBusinessPublish() {
  const allowedPrefixes = [
    path.join(projectRoot, "src/lib/queue"),
    path.join(projectRoot, "scripts/workers"),
    path.join(projectRoot, "scripts/consume-rabbitmq-events.ts"),
    path.join(projectRoot, "scripts/qa/workload-isolation-queue-topology.mjs"),
  ];
  const offenders = walkFiles(projectRoot).filter((file) => {
    const source = fs.readFileSync(file, "utf8");
    const usesAmqp = source.includes("amqplib");
    const directPublish =
      source.includes(".publish(") && source.includes("RabbitMQ");
    const allowed = allowedPrefixes.some((prefix) => file.startsWith(prefix));

    return !allowed && (usesAmqp || directPublish);
  });

  if (offenders.length > 0) {
    fail("Direct RabbitMQ publish usage found outside queue infrastructure.", {
      offenders: offenders.map((file) => path.relative(projectRoot, file)).join(","),
    });
  }

  pass("No direct RabbitMQ publish path was added to business logic.");
}

async function main() {
  if (!supabaseUrl || !serviceRoleKey) {
    fail("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const ticket = await placeQaTicket();
  await assertTicketAcceptedOutbox(ticket.ticketId);
  await assertQueueHealthAndTopology();
  assertNoDirectRabbitMqBusinessPublish();

  console.log(`correlationId: ${correlationId}`);
  console.log(`assertionsPassed: ${assertions.length}`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : "Workload isolation QA failed.");
});
