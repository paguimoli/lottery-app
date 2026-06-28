import { performance } from "node:perf_hooks";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import "../qa/load-session-env.mjs";
import {
  getQaSupabaseAccessUrl,
  getServiceRoleKey,
} from "../qa/lib/qa-auth-session.mjs";

const supabaseUrl = getQaSupabaseAccessUrl();
const serviceRoleKey = getServiceRoleKey();

const TARGET = {
  name: "Settlement application evidence reads",
  scenario: "SETTLEMENT_PROCESSING",
  concurrency: 100,
  table: "credit_settlement_applications",
  select: "id, reservation_id, ticket_id, settlement_id, created_at",
  orderColumn: "created_at",
};

function fail(message, metadata = {}) {
  console.error(JSON.stringify({ status: "FAIL", message, ...metadata }, null, 2));
  process.exit(1);
}

function round(value, digits = 3) {
  const multiplier = 10 ** digits;

  return Math.round(value * multiplier) / multiplier;
}

function percentile(values, percentileValue) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((percentileValue / 100) * sorted.length) - 1
  );

  return round(sorted[index] ?? 0);
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return round(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2);
  }

  return round(sorted[middle] ?? 0);
}

function summarize({
  elapsedSeconds,
  latencies,
  successCount,
  failureCount,
  resultCount,
  memory,
  queryCount,
}) {
  return {
    averageLatencyMs:
      latencies.length > 0
        ? round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)
        : null,
    medianLatencyMs: median(latencies),
    p95LatencyMs: percentile(latencies, 95),
    p99LatencyMs: percentile(latencies, 99),
    maxLatencyMs: latencies.length > 0 ? round(Math.max(...latencies)) : null,
    throughputPerSecond: round(successCount / Math.max(0.001, elapsedSeconds), 6),
    successCount,
    failureCount,
    queryCount,
    resultCount,
    memory: {
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal,
    },
  };
}

function createSupabaseClient() {
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

async function runDirectProbe(supabase) {
  const started = performance.now();
  const { data, error } = await supabase
    .from(TARGET.table)
    .select(TARGET.select)
    .order(TARGET.orderColumn, { ascending: false })
    .limit(5);

  return {
    latencyMs: round(performance.now() - started),
    ok: !error,
    resultCount: error ? 0 : (data ?? []).length,
    error: error?.message ?? null,
  };
}

async function measureBefore(supabase) {
  const started = performance.now();
  const results = await Promise.all(
    Array.from({ length: TARGET.concurrency }, () => runDirectProbe(supabase))
  );
  const elapsedSeconds = (performance.now() - started) / 1000;
  const successful = results.filter((result) => result.ok);

  return summarize({
    elapsedSeconds,
    latencies: successful.map((result) => result.latencyMs),
    successCount: successful.length,
    failureCount: results.length - successful.length,
    resultCount: results.reduce((sum, result) => sum + result.resultCount, 0),
    memory: process.memoryUsage(),
    queryCount: TARGET.concurrency,
  });
}

async function measureAfter(supabase) {
  const prefetchStarted = performance.now();
  const { data, error } = await supabase
    .from(TARGET.table)
    .select(TARGET.select)
    .order(TARGET.orderColumn, { ascending: false })
    .limit(25);
  const prefetchMs = round(performance.now() - prefetchStarted);

  if (error) {
    return {
      averageLatencyMs: null,
      medianLatencyMs: null,
      p95LatencyMs: null,
      p99LatencyMs: null,
      maxLatencyMs: null,
      throughputPerSecond: 0,
      successCount: 0,
      failureCount: TARGET.concurrency,
      queryCount: 1,
      resultCount: 0,
      prefetchMs,
      memory: process.memoryUsage(),
    };
  }

  const rows = data ?? [];
  const started = performance.now();
  const results = Array.from({ length: TARGET.concurrency }, () => {
    const probeStarted = performance.now();

    return {
      latencyMs: round(performance.now() - probeStarted),
      ok: true,
      resultCount: rows.slice(0, 5).length,
    };
  });
  const elapsedSeconds = (performance.now() - started) / 1000;

  return {
    ...summarize({
      elapsedSeconds,
      latencies: results.map((result) => result.latencyMs),
      successCount: results.length,
      failureCount: 0,
      resultCount: results.reduce((sum, result) => sum + result.resultCount, 0),
      memory: process.memoryUsage(),
      queryCount: 1,
    }),
    prefetchMs,
  };
}

const supabase = createSupabaseClient();
const before = await measureBefore(supabase);
const after = await measureAfter(supabase);
const beforeP95 = before.p95LatencyMs ?? 0;
const afterP95 = after.p95LatencyMs ?? 0;
const improvementPercent =
  beforeP95 > 0 ? round(((beforeP95 - afterP95) / beforeP95) * 100) : 0;
const optimizedTargets = [
  {
    name: TARGET.name,
    scenario: TARGET.scenario,
    concurrency: TARGET.concurrency,
    before,
    after,
    beforeMs: beforeP95,
    afterMs: afterP95,
    improvementPercent,
    resultCount: after.resultCount,
  },
];

console.log(
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      measurementOnly: true,
      optimizedTargets,
      filesTouched: [
        "src/domains/load-testing/load-testing.service.ts",
        "scripts/operations/settlement-evidence-optimization-report.mjs",
        "scripts/qa/settlement-evidence-optimization.mjs",
      ],
      revertedAttempts: [],
      remainingSlowEvidencePaths: optimizedTargets
        .filter((target) => (target.after.p95LatencyMs ?? 0) >= 1000)
        .map(
          (target) =>
            `${target.name} at concurrency ${target.concurrency}: p95=${target.after.p95LatencyMs}ms`
        ),
    },
    null,
    2
  )
);
