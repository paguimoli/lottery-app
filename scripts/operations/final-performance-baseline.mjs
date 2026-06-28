import { spawnSync } from "node:child_process";
import "../qa/load-session-env.mjs";

const appUrl = process.env.OPS_APP_URL || process.env.QA_APP_URL || "http://localhost:3000";
let sessionToken =
  process.env.OPS_ADMIN_SESSION_TOKEN || process.env.QA_ADMIN_SESSION_TOKEN;
const adminUsername = process.env.QA_ADMIN_USERNAME || "admin2";
const adminPassword = process.env.QA_ADMIN_PASSWORD || "";

function fail(message, metadata = {}) {
  console.error(JSON.stringify({ status: "FAIL", message, ...metadata }, null, 2));
  process.exit(1);
}

function round(value, digits = 3) {
  if (!Number.isFinite(value)) return null;
  const multiplier = 10 ** digits;

  return Math.round(value * multiplier) / multiplier;
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

async function authGet(path) {
  const { response, body } = await requestJson(path, {
    headers: { authorization: `Bearer ${sessionToken}` },
  });

  if (!response.ok || body?.success !== true) {
    fail(`${path} failed.`, { status: response.status, body });
  }

  return body;
}

function isFinancialPath(entry) {
  const tokens = [
    entry.scenario,
    entry.step,
    entry.area,
    entry.metric,
    entry.label,
    entry.source,
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  return /SETTLEMENT|LEDGER|CREDIT|WALLET|TICKET|FINANCIAL|DATABASE/.test(tokens);
}

function classifyLatency(entry) {
  const p95 = entry.p95LatencyMs ?? entry.observedMs ?? null;
  const financialPath = isFinancialPath(entry);

  if (financialPath && ((p95 ?? 0) >= 1000 || (entry.errorCount ?? 0) > 0)) {
    return "CRITICAL";
  }

  if ((p95 ?? 0) > 1000) return "HIGH";
  if ((p95 ?? 0) >= 500) return "MEDIUM";
  if ((p95 ?? 0) >= 250) return "LOW";

  return "IGNORE";
}

function recommendationFor(classified) {
  const material = classified.filter((item) =>
    item.classification === "CRITICAL" || item.classification === "HIGH"
  );

  if (material.length > 0) {
    return {
      decision: "A",
      recommendation: "Continue optimization.",
      reason: "At least one material CRITICAL/HIGH bottleneck remains.",
    };
  }

  return {
    decision: "B",
    recommendation: "Performance engineering complete. Proceed to Phase 21 Resilience Engineering.",
    reason: "No repeated P95 >1000ms bottleneck was detected in the final baseline.",
  };
}

function parseJsonFromStdout(stdout, script) {
  const jsonStart = stdout.indexOf("{");

  if (jsonStart < 0) {
    fail(`${script} did not emit JSON.`, { stdout });
  }

  try {
    return JSON.parse(stdout.slice(jsonStart));
  } catch (error) {
    fail(`${script} emitted invalid JSON.`, {
      error: error instanceof Error ? error.message : String(error),
      stdout,
    });
  }
}

function runReport(script) {
  const result = spawnSync("npm", ["run", script], {
    encoding: "utf8",
    env: {
      ...process.env,
      OPS_ADMIN_SESSION_TOKEN: sessionToken,
      QA_ADMIN_SESSION_TOKEN: sessionToken,
    },
  });

  if (result.status !== 0) {
    fail(`${script} failed.`, {
      stdout: result.stdout,
      stderr: result.stderr,
    });
  }

  return parseJsonFromStdout(result.stdout, script);
}

function scenarioLatencyRows(concurrencyBaseline) {
  return concurrencyBaseline.scenarios
    .flatMap((scenario) =>
      scenario.stepMeasurements.map((step) => ({
        source: "concurrency-baseline",
        scenario: scenario.scenario,
        scenarioLabel: scenario.label,
        concurrency: scenario.concurrency,
        step: step.step,
        stepLabel: step.label,
        averageLatencyMs: step.averageLatencyMs,
        medianLatencyMs: step.medianLatencyMs,
        p95LatencyMs: step.p95LatencyMs,
        p99LatencyMs: step.p99LatencyMs,
        maxLatencyMs: step.maxLatencyMs,
        throughputPerSecond: step.throughputPerSecond,
        errorCount: step.errorCount,
        sampleCount: step.sampleCount,
      }))
    )
    .sort((left, right) => {
      const p95Delta = (right.p95LatencyMs ?? -1) - (left.p95LatencyMs ?? -1);

      if (p95Delta !== 0) return p95Delta;

      return (right.p99LatencyMs ?? -1) - (left.p99LatencyMs ?? -1);
    });
}

function performanceBottleneckRows(performanceBaseline) {
  return (performanceBaseline.bottlenecks ?? []).map((bottleneck) => ({
    source: "performance-baseline",
    area: bottleneck.area,
    impact: bottleneck.impact,
    metric: bottleneck.metric,
    observedValue: bottleneck.observedValue,
    recommendation: bottleneck.recommendation,
  }));
}

await ensureSessionToken();

const [performancePayload, concurrencyPayload, queryOptimizationReport] =
  await Promise.all([
    authGet("/api/operations/performance-baseline"),
    authGet("/api/operations/concurrency-baseline"),
    Promise.resolve(runReport("ops:query-optimization-report")),
  ]);

const performanceBaseline = performancePayload.performanceBaseline;
const concurrencyBaseline = concurrencyPayload.concurrencyBaseline;
const bottleneckReport = runReport("ops:concurrency-bottleneck-report");
const top20LatencyRanking = scenarioLatencyRows(concurrencyBaseline)
  .slice(0, 20)
  .map((entry, index) => ({
    rank: index + 1,
    ...entry,
    financialPath: isFinancialPath(entry),
    classification: classifyLatency(entry),
  }));
const remainingBottlenecks = top20LatencyRanking.filter(
  (entry) => entry.classification !== "IGNORE"
);
const performanceBottlenecks = performanceBottleneckRows(performanceBaseline);
const recommendation = recommendationFor(remainingBottlenecks);

console.log(
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      measurementOnly: true,
      platformState: {
        settlement: `${performanceBaseline.authorityBaseline.settlement.authority}/${performanceBaseline.authorityBaseline.settlement.certificationStatus}`,
        ledger: `${performanceBaseline.authorityBaseline.ledger.authority}/${performanceBaseline.authorityBaseline.ledger.certificationStatus}`,
        credit: `${performanceBaseline.authorityBaseline.credit.authority}/${performanceBaseline.authorityBaseline.credit.certificationStatus}`,
        comparison: {
          settlement: performanceBaseline.authorityBaseline.settlement.comparisonMode,
          ledger: performanceBaseline.authorityBaseline.ledger.comparisonMode,
          credit: performanceBaseline.authorityBaseline.credit.comparisonMode,
        },
        rollback: {
          settlement: performanceBaseline.authorityBaseline.settlement.rollbackReadiness,
          ledger: performanceBaseline.authorityBaseline.ledger.rollbackReadiness,
          credit: performanceBaseline.authorityBaseline.credit.rollbackReadiness,
        },
      },
      authoritativeBaseline: {
        performanceGeneratedAt: performanceBaseline.generatedAt,
        concurrencyGeneratedAt: concurrencyBaseline.generatedAt,
        httpAverageMs: performanceBaseline.http.averageMs,
        databaseAverageQueryMs: performanceBaseline.database.averageQueryDurationMs,
        scenarioCount: concurrencyBaseline.scenarios.length,
        slowestP95LatencyMs: top20LatencyRanking[0]?.p95LatencyMs ?? null,
        bottleneckCount: concurrencyBaseline.bottlenecks.length,
      },
      throughputSummary: {
        highestScenarioThroughputPerSecond: round(
          Math.max(
            ...concurrencyBaseline.scenarios.map(
              (scenario) => scenario.throughputPerSecond ?? 0
            )
          ),
          6
        ),
        outboxPublishedPerSecond: performanceBaseline.throughput.outbox.publishedPerSecond,
        outboxPending: performanceBaseline.throughput.outbox.pending,
        rabbitmqQueueDepth: performanceBaseline.throughput.rabbitmq.queueDepth,
        runningWorkers: performanceBaseline.throughput.workers.runningWorkers,
        staleWorkers: performanceBaseline.throughput.workers.staleWorkers,
      },
      top20LatencyRanking,
      remainingBottlenecks,
      performanceBottlenecks,
      bottleneckReport: {
        slowest: bottleneckReport.slowest,
        bottlenecks: bottleneckReport.bottlenecks,
      },
      queryOptimizationReport: {
        optimizedTargets: queryOptimizationReport.optimizedTargets ?? [],
        revertedTargets: queryOptimizationReport.revertedTargets ?? [],
        remainingSlowTargets: queryOptimizationReport.remainingSlowTargets ?? [],
      },
      recommendation,
    },
    null,
    2
  )
);
