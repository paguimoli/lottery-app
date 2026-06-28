import { spawnSync } from "node:child_process";
import "../qa/load-session-env.mjs";

const appUrl =
  process.env.OPS_APP_URL || process.env.QA_APP_URL || "http://localhost:3000";
let sessionToken =
  process.env.OPS_ADMIN_SESSION_TOKEN || process.env.QA_ADMIN_SESSION_TOKEN;
const adminUsername = process.env.QA_ADMIN_USERNAME || "admin2";
const adminPassword = process.env.QA_ADMIN_PASSWORD || "";
const args = process.argv.slice(2);

function getArg(name, fallback = "") {
  const index = args.indexOf(name);

  return index >= 0 ? args[index + 1] ?? fallback : fallback;
}

function hasFlag(name) {
  return args.includes(name);
}

const drill = getArg("--drill", "RESTART_OUTBOX_DISPATCHER");
const execute = hasFlag("--execute");
const confirm = hasFlag("--confirm");

const composeServiceByDrill = {
  RESTART_OUTBOX_DISPATCHER: "outbox-dispatcher",
  RESTART_WORKER: "worker-reporting",
  RESTART_RABBITMQ_CONSUMER: "worker-ticket-lifecycle",
  RABBITMQ_DISCONNECT_RECONNECT: "rabbitmq",
  REDIS_DISCONNECT_RECONNECT: "redis",
  RESTART_APPLICATION: "app",
};

function fail(message, metadata = {}) {
  console.error(JSON.stringify({ status: "FAIL", message, ...metadata }, null, 2));
  process.exit(1);
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${appUrl}${path}`, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  return { response, body };
}

async function ensureSessionToken() {
  if (sessionToken) {
    const { response } = await requestJson("/api/auth/me", {
      headers: { authorization: `Bearer ${sessionToken}` },
    });

    if (response.ok) return;
  }

  if (!adminPassword) {
    fail("OPS_ADMIN_SESSION_TOKEN, QA_ADMIN_SESSION_TOKEN, or QA_ADMIN_PASSWORD is required.");
  }

  const { response, body } = await requestJson("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: adminUsername,
      password: adminPassword,
    }),
  });

  if (!response.ok || body?.success !== true || !body.sessionToken) {
    fail("Unable to establish admin session.", { status: response.status, body });
  }

  sessionToken = body.sessionToken;
}

function restartService(service) {
  const startedAt = Date.now();
  const result = spawnSync("docker", ["compose", "restart", service], {
    stdio: "pipe",
    encoding: "utf8",
  });

  if (result.status !== 0) {
    fail("Docker Compose restart failed.", {
      service,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  }

  return Date.now() - startedAt;
}

await ensureSessionToken();

const simulationResult = await requestJson("/api/operations/fault-injection/simulate", {
  method: "POST",
  headers: {
    authorization: `Bearer ${sessionToken}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({ drill, confirm }),
});

if (!simulationResult.response.ok || simulationResult.body?.success !== true) {
  fail("Fault injection simulation failed.", {
    status: simulationResult.response.status,
    body: simulationResult.body,
  });
}

let restart = null;

if (execute) {
  const service = composeServiceByDrill[drill];

  if (!service) {
    fail("This drill is simulation-only from the operations script.", { drill });
  }

  restart = {
    service,
    recoveryTimeMs: restartService(service),
  };
}

const metricsResult = await requestJson("/api/operations/fault-recovery-metrics", {
  headers: { authorization: `Bearer ${sessionToken}` },
});

if (!metricsResult.response.ok || metricsResult.body?.success !== true) {
  fail("Fault recovery metrics endpoint failed.", {
    status: metricsResult.response.status,
    body: metricsResult.body,
  });
}

console.log(
  JSON.stringify(
    {
      status: "PASS",
      drill,
      executed: execute,
      restart,
      simulation: simulationResult.body.faultInjectionSimulation,
      recoveryMetrics: metricsResult.body.faultRecoveryMetrics,
    },
    null,
    2
  )
);
