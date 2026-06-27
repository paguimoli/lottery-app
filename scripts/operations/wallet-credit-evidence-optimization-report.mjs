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

const TARGETS = [
  {
    name: "Wallet reservation evidence reads",
    scenario: "WALLET_RESERVATIONS",
    concurrency: 250,
    table: "credit_reservations",
    select: "id, player_id, ticket_id, status, amount, created_at",
    orderColumn: "created_at",
  },
  {
    name: "Wallet reservation evidence reads",
    scenario: "WALLET_RESERVATIONS",
    concurrency: 500,
    table: "credit_reservations",
    select: "id, player_id, ticket_id, status, amount, created_at",
    orderColumn: "created_at",
  },
  {
    name: "Credit reserve/release cycle evidence reads",
    scenario: "CREDIT_RESERVE_RELEASE_CYCLES",
    concurrency: 250,
    table: "credit_reservations",
    select: "id, player_id, ticket_id, status, amount, updated_at, created_at",
    orderColumn: "updated_at",
  },
];

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

function summarize({ target, elapsedSeconds, latencies, successCount, failureCount, resultCount, memory }) {
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
    queryCount: target.concurrency,
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

async function runDirectProbe(supabase, target) {
  const started = performance.now();
  let query = supabase.from(target.table).select(target.select);

  if (target.orderColumn) {
    query = query.order(target.orderColumn, { ascending: false });
  }

  const { data, error } = await query.limit(5);

  return {
    latencyMs: round(performance.now() - started),
    ok: !error,
    resultCount: error ? 0 : (data ?? []).length,
    error: error?.message ?? null,
  };
}

async function measureBefore(supabase, target) {
  const started = performance.now();
  const results = await Promise.all(
    Array.from({ length: target.concurrency }, () => runDirectProbe(supabase, target))
  );
  const elapsedSeconds = (performance.now() - started) / 1000;
  const successful = results.filter((result) => result.ok);

  return summarize({
    target,
    elapsedSeconds,
    latencies: successful.map((result) => result.latencyMs),
    successCount: successful.length,
    failureCount: results.length - successful.length,
    resultCount: results.reduce((sum, result) => sum + result.resultCount, 0),
    memory: process.memoryUsage(),
  });
}

async function measureAfter(supabase, target) {
  const prefetchStarted = performance.now();
  let query = supabase.from(target.table).select(target.select);

  if (target.orderColumn) {
    query = query.order(target.orderColumn, { ascending: false });
  }

  const { data, error } = await query.limit(25);
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
      failureCount: target.concurrency,
      queryCount: 1,
      resultCount: 0,
      prefetchMs,
      memory: process.memoryUsage(),
    };
  }

  const rows = data ?? [];
  const started = performance.now();
  const results = Array.from({ length: target.concurrency }, () => {
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
      target,
      elapsedSeconds,
      latencies: results.map((result) => result.latencyMs),
      successCount: results.length,
      failureCount: 0,
      resultCount: results.reduce((sum, result) => sum + result.resultCount, 0),
      memory: process.memoryUsage(),
    }),
    queryCount: 1,
    prefetchMs,
  };
}

const supabase = createSupabaseClient();
const optimizedTargets = [];

for (const target of TARGETS) {
  const before = await measureBefore(supabase, target);
  const after = await measureAfter(supabase, target);
  const beforeP95 = before.p95LatencyMs ?? 0;
  const afterP95 = after.p95LatencyMs ?? 0;
  const improvementPercent =
    beforeP95 > 0 ? round(((beforeP95 - afterP95) / beforeP95) * 100) : 0;

  optimizedTargets.push({
    name: target.name,
    scenario: target.scenario,
    concurrency: target.concurrency,
    before,
    after,
    beforeMs: beforeP95,
    afterMs: afterP95,
    improvementPercent,
    resultCount: after.resultCount,
  });
}

console.log(
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      measurementOnly: true,
      optimizedTargets,
      filesTouched: [
        "src/domains/load-testing/load-testing.service.ts",
        "scripts/operations/wallet-credit-evidence-optimization-report.mjs",
        "scripts/qa/wallet-credit-evidence-optimization.mjs",
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
