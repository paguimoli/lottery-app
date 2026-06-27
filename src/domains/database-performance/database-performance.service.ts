import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { supabaseServerAdmin } from "@/src/lib/supabase/server-admin-client";
import type {
  DatabaseConnectionSummary,
  DatabaseHotspot,
  DatabaseLatencySummary,
  DatabasePerformanceRecommendation,
  DatabasePerformanceReport,
  DatabaseQueryMeasurement,
  DatabaseTransactionSummary,
  SlowQueryBucket,
  SlowQueryReport,
} from "./database-performance.types";

type MeasurementDefinition = {
  id: string;
  label: string;
  table: string;
  operation: "COUNT" | "SAMPLE_RECENT" | "SAMPLE_FILTERED";
  repositoryMethod: string | null;
  endpoint: string | null;
  select: string;
  orderColumn?: string;
  filter?: {
    column: string;
    operator: "eq" | "gte" | "in";
    value: string | string[];
  };
};

const OFFICIAL_PHASE_19_0_BASELINE = {
  phase: "19.0" as const,
  averageSampledDbLatencyMs: 811,
  slowestSampledQueryMs: 946,
  connectionPoolMetrics: "UNAVAILABLE" as const,
  transactionDurationVisibility: "LIMITED" as const,
};

const SLOW_QUERY_THRESHOLD_MS = 500;

const MEASUREMENTS: MeasurementDefinition[] = [
  {
    id: "financial-wallet-count",
    label: "Financial wallet count",
    table: "financial_wallets",
    operation: "COUNT",
    repositoryMethod: "credit/wallet summary",
    endpoint: "/api/accounts/[accountId]/wallets",
    select: "id",
  },
  {
    id: "ledger-entry-count",
    label: "Ledger entry count",
    table: "financial_ledger_entries",
    operation: "COUNT",
    repositoryMethod: "ledger/reference audit",
    endpoint: "/api/wallets/[walletId]/ledger",
    select: "id",
  },
  {
    id: "credit-reservation-count",
    label: "Credit reservation count",
    table: "credit_reservations",
    operation: "COUNT",
    repositoryMethod: "credit-reservation.repository",
    endpoint: "/api/credit/reservations",
    select: "id",
  },
  {
    id: "credit-settlement-application-count",
    label: "Credit settlement application count",
    table: "credit_settlement_applications",
    operation: "COUNT",
    repositoryMethod: "credit settlement application",
    endpoint: "/api/credit/settlements/apply",
    select: "id",
  },
  {
    id: "outbox-pending-count",
    label: "Pending outbox count",
    table: "outbox_events",
    operation: "SAMPLE_FILTERED",
    repositoryMethod: "outbox.repository",
    endpoint: "/api/operations/outbox",
    select: "id, created_at, status",
    orderColumn: "created_at",
    filter: {
      column: "status",
      operator: "in",
      value: ["PENDING", "FAILED"],
    },
  },
  {
    id: "recent-outbox-events",
    label: "Recent outbox events",
    table: "outbox_events",
    operation: "SAMPLE_RECENT",
    repositoryMethod: "outbox.repository",
    endpoint: "/api/workers/outbox-events",
    select: "id, created_at, status, event_type",
    orderColumn: "created_at",
  },
  {
    id: "recent-worker-heartbeats",
    label: "Recent worker heartbeats",
    table: "worker_heartbeats",
    operation: "SAMPLE_RECENT",
    repositoryMethod: "worker-observability.repository",
    endpoint: "/api/operations/workers",
    select: "id, created_at, last_seen_at, worker_name",
    orderColumn: "last_seen_at",
  },
  {
    id: "recent-authority-approvals",
    label: "Recent authority approvals",
    table: "authority_approval_records",
    operation: "SAMPLE_RECENT",
    repositoryMethod: "authority-approval.repository",
    endpoint: "/api/authority/approval-history",
    select: "id, created_at, approval_type, domain",
    orderColumn: "created_at",
  },
  {
    id: "recent-credit-shadow-runs",
    label: "Recent credit shadow runs",
    table: "credit_shadow_runs",
    operation: "SAMPLE_RECENT",
    repositoryMethod: "credit-authority evidence",
    endpoint: "/api/credit-shadow/summary",
    select: "id, created_at, comparison_status",
    orderColumn: "created_at",
  },
  {
    id: "recent-settlement-shadow-runs",
    label: "Recent settlement shadow runs",
    table: "settlement_shadow_runs",
    operation: "SAMPLE_RECENT",
    repositoryMethod: "settlement-shadow.repository",
    endpoint: "/api/settlement-shadow/summary",
    select: "id, created_at, comparison_status",
    orderColumn: "created_at",
  },
  {
    id: "recent-ledger-shadow-runs",
    label: "Recent ledger shadow runs",
    table: "ledger_shadow_runs",
    operation: "SAMPLE_RECENT",
    repositoryMethod: "ledger-authority evidence",
    endpoint: "/api/ledger-shadow/summary",
    select: "id, created_at, comparison_status",
    orderColumn: "created_at",
  },
];

function nowIso() {
  return new Date().toISOString();
}

function round(value: number, digits = 3) {
  const multiplier = 10 ** digits;

  return Math.round(value * multiplier) / multiplier;
}

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((percentileValue / 100) * sorted.length) - 1
  );

  return round(sorted[index] ?? 0);
}

function average(values: number[]) {
  if (values.length === 0) return null;

  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown database measurement error.";
}

async function runMeasurement(
  definition: MeasurementDefinition
): Promise<DatabaseQueryMeasurement> {
  const startedAt = nowIso();
  const started = performance.now();

  try {
    if (definition.operation === "COUNT") {
      const { count, error } = await supabaseServerAdmin
        .from(definition.table)
        .select(definition.select, { count: "exact", head: true });

      if (error) throw new Error(error.message);

      return {
        id: definition.id,
        label: definition.label,
        table: definition.table,
        operation: definition.operation,
        accessType: "READ",
        repositoryMethod: definition.repositoryMethod,
        endpoint: definition.endpoint,
        startedAt,
        completedAt: nowIso(),
        durationMs: round(performance.now() - started),
        rowCount: count ?? 0,
        status: "READY",
        error: null,
      };
    }

    let query = supabaseServerAdmin
      .from(definition.table)
      .select(definition.select)
      .limit(50);

    if (definition.filter?.operator === "eq") {
      query = query.eq(definition.filter.column, definition.filter.value as string);
    }

    if (definition.filter?.operator === "gte") {
      query = query.gte(definition.filter.column, definition.filter.value as string);
    }

    if (definition.filter?.operator === "in") {
      query = query.in(
        definition.filter.column,
        definition.filter.value as string[]
      );
    }

    if (definition.orderColumn) {
      query = query.order(definition.orderColumn, { ascending: false });
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    return {
      id: definition.id,
      label: definition.label,
      table: definition.table,
      operation: definition.operation,
      accessType: "READ",
      repositoryMethod: definition.repositoryMethod,
      endpoint: definition.endpoint,
      startedAt,
      completedAt: nowIso(),
      durationMs: round(performance.now() - started),
      rowCount: (data ?? []).length,
      status: "READY",
      error: null,
    };
  } catch (error) {
    return {
      id: definition.id,
      label: definition.label,
      table: definition.table,
      operation: definition.operation,
      accessType: "READ",
      repositoryMethod: definition.repositoryMethod,
      endpoint: definition.endpoint,
      startedAt,
      completedAt: nowIso(),
      durationMs: null,
      rowCount: null,
      status: "UNAVAILABLE",
      error: getErrorMessage(error),
    };
  }
}

function summarizeLatency(
  measurements: DatabaseQueryMeasurement[],
  intervalMs: number
): DatabaseLatencySummary {
  const durations = measurements
    .map((measurement) => measurement.durationMs)
    .filter((duration): duration is number => duration !== null);
  const reads = measurements.filter((measurement) => measurement.accessType === "READ");
  const writes = measurements.filter(
    (measurement) => measurement.accessType === "WRITE"
  );
  const intervalSeconds = Math.max(1, intervalMs / 1000);

  return {
    averageMs: average(durations),
    medianMs: percentile(durations, 50),
    p95Ms: percentile(durations, 95),
    p99Ms: percentile(durations, 99),
    minMs: durations.length > 0 ? round(Math.min(...durations)) : null,
    maxMs: durations.length > 0 ? round(Math.max(...durations)) : null,
    queryCount: measurements.length,
    queriesPerSecond: round(measurements.length / intervalSeconds, 6),
    readsPerSecond: round(reads.length / intervalSeconds, 6),
    writesPerSecond: round(writes.length / intervalSeconds, 6),
    readWriteRatio: `${reads.length}:${writes.length}`,
  };
}

function getConnectionSummary(sampledAt: string): DatabaseConnectionSummary {
  return {
    status: "UNAVAILABLE",
    activeConnections: null,
    idleConnections: null,
    waitingConnections: null,
    concurrentConnections: null,
    poolUtilization: null,
    poolExhaustionEvents: null,
    source: "SUPABASE_REST_LIMITED",
    sampledAt,
    limitations: [
      "Supabase REST/service-role access does not expose pg_stat_activity or pooler internals in this environment.",
      "No database mutations or schema changes were introduced to collect pool metrics.",
    ],
  };
}

function summarizeTransactions(
  measurements: DatabaseQueryMeasurement[],
  intervalMs: number
): DatabaseTransactionSummary {
  const durations = measurements
    .map((measurement) => measurement.durationMs)
    .filter((duration): duration is number => duration !== null);
  const rowCounts = measurements
    .map((measurement) => measurement.rowCount)
    .filter((rowCount): rowCount is number => rowCount !== null);
  const intervalSeconds = Math.max(1, intervalMs / 1000);

  return {
    status: "WARNING",
    transactionCount: measurements.length,
    transactionFrequencyPerSecond: round(measurements.length / intervalSeconds, 6),
    averageTransactionDurationMs: average(durations),
    maxTransactionDurationMs:
      durations.length > 0 ? round(Math.max(...durations)) : null,
    longestRunningTransaction: {
      durationMs: null,
      startedAt: null,
      state: null,
    },
    concurrentTransactions: null,
    averageTransactionSizeRows: average(rowCounts),
    maxTransactionSizeRows: rowCounts.length > 0 ? Math.max(...rowCounts) : null,
    lockWaits: null,
    source: "APPLICATION_SAMPLED_READS",
    limitations: [
      "Transaction duration is measured from read-only application sampling, not pg_stat_activity.",
      "Lock waits and concurrent transaction state require database-native telemetry access.",
    ],
  };
}

function buildHistogram(measurements: DatabaseQueryMeasurement[]): SlowQueryBucket[] {
  const buckets: SlowQueryBucket[] = [
    { label: "0-100ms", minMs: 0, maxMs: 100, count: 0 },
    { label: "100-250ms", minMs: 100, maxMs: 250, count: 0 },
    { label: "250-500ms", minMs: 250, maxMs: 500, count: 0 },
    { label: "500-1000ms", minMs: 500, maxMs: 1000, count: 0 },
    { label: "1000ms+", minMs: 1000, maxMs: null, count: 0 },
  ];

  for (const measurement of measurements) {
    if (measurement.durationMs === null) continue;
    const durationMs = measurement.durationMs;
    const bucket = buckets.find(
      (item) =>
        durationMs >= item.minMs && (item.maxMs === null || durationMs < item.maxMs)
    );

    if (bucket) bucket.count += 1;
  }

  return buckets;
}

function buildSlowQueryReport(
  measurements: DatabaseQueryMeasurement[],
  intervalMs: number
): SlowQueryReport {
  const byTable = new Map<string, number[]>();

  for (const measurement of measurements) {
    if (measurement.durationMs === null) continue;
    const durations = byTable.get(measurement.table) ?? [];
    durations.push(measurement.durationMs);
    byTable.set(measurement.table, durations);
  }

  return {
    generatedAt: nowIso(),
    measurementIntervalMs: intervalMs,
    thresholdMs: SLOW_QUERY_THRESHOLD_MS,
    histogram: buildHistogram(measurements),
    topSlowQueries: [...measurements]
      .filter((measurement) => measurement.durationMs !== null)
      .sort((left, right) => (right.durationMs ?? 0) - (left.durationMs ?? 0))
      .slice(0, 10),
    topQueriedTables: [...byTable.entries()]
      .map(([table, durations]) => ({
        table,
        queryCount: durations.length,
        averageDurationMs: average(durations),
        maxDurationMs: durations.length > 0 ? round(Math.max(...durations)) : null,
      }))
      .sort((left, right) => {
        const maxDelta = (right.maxDurationMs ?? 0) - (left.maxDurationMs ?? 0);

        return maxDelta !== 0 ? maxDelta : right.queryCount - left.queryCount;
      })
      .slice(0, 10),
  };
}

function listFiles(root: string, predicate: (filePath: string) => boolean) {
  const files: string[] = [];

  if (!fs.existsSync(root)) return files;

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      if (["node_modules", ".next", ".git"].includes(entry.name)) continue;
      files.push(...listFiles(fullPath, predicate));
      continue;
    }

    if (entry.isFile() && predicate(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

function countMatches(source: string, pattern: RegExp) {
  return [...source.matchAll(pattern)].length;
}

function buildRepositoryHotspots(
  measurements: DatabaseQueryMeasurement[]
): DatabaseHotspot[] {
  const root = path.join(process.cwd(), "src", "domains");
  const files = listFiles(root, (filePath) => filePath.endsWith(".ts"));
  const measuredByMethod = new Map<string, DatabaseQueryMeasurement[]>();

  for (const measurement of measurements) {
    if (!measurement.repositoryMethod) continue;
    const entries = measuredByMethod.get(measurement.repositoryMethod) ?? [];
    entries.push(measurement);
    measuredByMethod.set(measurement.repositoryMethod, entries);
  }

  return files
    .map((filePath) => {
      const source = fs.readFileSync(filePath, "utf8");
      const relativePath = path.relative(process.cwd(), filePath);
      const readIndicators = countMatches(source, /\.select\(|\.rpc\(/g);
      const writeIndicators = countMatches(
        source,
        /\.insert\(|\.update\(|\.upsert\(|\.delete\(/g
      );
      const matchingMeasurements = [...measuredByMethod.entries()]
        .filter(([method]) => relativePath.includes(method.split(".")[0]))
        .flatMap(([, entries]) => entries);
      const durations = matchingMeasurements
        .map((measurement) => measurement.durationMs)
        .filter((duration): duration is number => duration !== null);

      return {
        name: relativePath,
        type: "REPOSITORY" as const,
        queryCount: readIndicators + writeIndicators,
        measuredAverageMs: average(durations),
        measuredMaxMs: durations.length > 0 ? round(Math.max(...durations)) : null,
        writeIndicators,
        readIndicators,
        evidence: [
          `${readIndicators} read indicator(s)`,
          `${writeIndicators} write indicator(s)`,
          `${matchingMeasurements.length} direct sampled measurement(s)`,
        ],
      };
    })
    .filter((hotspot) => hotspot.queryCount > 0)
    .sort((left, right) => {
      const writeDelta = right.writeIndicators - left.writeIndicators;

      return writeDelta !== 0 ? writeDelta : right.queryCount - left.queryCount;
    })
    .slice(0, 10)
    .map((hotspot, index) => ({ rank: index + 1, ...hotspot }));
}

function buildApiHotspots(measurements: DatabaseQueryMeasurement[]): DatabaseHotspot[] {
  const root = path.join(process.cwd(), "app", "api");
  const files = listFiles(root, (filePath) => filePath.endsWith("route.ts"));
  const measuredByEndpoint = new Map<string, DatabaseQueryMeasurement[]>();

  for (const measurement of measurements) {
    if (!measurement.endpoint) continue;
    const entries = measuredByEndpoint.get(measurement.endpoint) ?? [];
    entries.push(measurement);
    measuredByEndpoint.set(measurement.endpoint, entries);
  }

  return files
    .map((filePath) => {
      const source = fs.readFileSync(filePath, "utf8");
      const relativePath = path.relative(process.cwd(), filePath);
      const endpoint = `/${relativePath
        .replace(/^app\//, "")
        .replace(/\/route\.ts$/, "")
        .replace(/\[([^\]]+)\]/g, "[$1]")}`;
      const readIndicators = countMatches(source, /GET\(|export async function GET/g);
      const writeIndicators = countMatches(
        source,
        /POST\(|PUT\(|PATCH\(|DELETE\(|export async function (POST|PUT|PATCH|DELETE)/g
      );
      const matchingMeasurements = [...measuredByEndpoint.entries()]
        .filter(([measuredEndpoint]) => endpoint === measuredEndpoint)
        .flatMap(([, entries]) => entries);
      const durations = matchingMeasurements
        .map((measurement) => measurement.durationMs)
        .filter((duration): duration is number => duration !== null);

      return {
        name: endpoint,
        type: "API_ENDPOINT" as const,
        queryCount: readIndicators + writeIndicators + matchingMeasurements.length,
        measuredAverageMs: average(durations),
        measuredMaxMs: durations.length > 0 ? round(Math.max(...durations)) : null,
        writeIndicators,
        readIndicators,
        evidence: [
          `${readIndicators} read route indicator(s)`,
          `${writeIndicators} write route indicator(s)`,
          `${matchingMeasurements.length} direct sampled measurement(s)`,
        ],
      };
    })
    .filter((hotspot) => hotspot.queryCount > 0)
    .sort((left, right) => {
      const measuredDelta = (right.measuredMaxMs ?? 0) - (left.measuredMaxMs ?? 0);
      if (measuredDelta !== 0) return measuredDelta;

      return right.writeIndicators - left.writeIndicators;
    })
    .slice(0, 10)
    .map((hotspot, index) => ({ rank: index + 1, ...hotspot }));
}

function buildRecommendations(input: {
  latency: DatabaseLatencySummary;
  connections: DatabaseConnectionSummary;
  transactions: DatabaseTransactionSummary;
  slowQueries: SlowQueryReport;
  repositoryHotspots: DatabaseHotspot[];
  apiHotspots: DatabaseHotspot[];
}): DatabasePerformanceRecommendation[] {
  const recommendations: Omit<DatabasePerformanceRecommendation, "rank">[] = [];
  const slowest = input.slowQueries.topSlowQueries[0];
  const repository = input.repositoryHotspots[0];
  const endpoint = input.apiHotspots[0];

  if (slowest?.durationMs !== null && slowest?.durationMs !== undefined) {
    recommendations.push({
      impact: slowest.durationMs >= 1000 ? "HIGH" : "MEDIUM",
      area: "QUERY_LATENCY",
      metric: slowest.label,
      observedValue: `${slowest.durationMs}ms`,
      recommendation:
        "Use this measured query as the first candidate for explain-plan analysis in a future optimization phase.",
    });
  }

  recommendations.push({
    impact: "MEDIUM",
    area: "CONNECTION_POOL",
    metric: "connection pool telemetry",
    observedValue: input.connections.status,
    recommendation:
      "Enable database-native pool telemetry before changing connection or pool settings.",
  });

  recommendations.push({
    impact: "MEDIUM",
    area: "TRANSACTIONS",
    metric: "lock waits and concurrent transaction visibility",
    observedValue: String(input.transactions.lockWaits ?? "unavailable"),
    recommendation:
      "Expose pg_stat_activity or equivalent read-only telemetry before transaction tuning.",
  });

  if (repository) {
    recommendations.push({
      impact: repository.writeIndicators > 0 ? "MEDIUM" : "LOW",
      area: "REPOSITORY_HOTSPOT",
      metric: repository.name,
      observedValue: `${repository.queryCount} static DB indicator(s)`,
      recommendation:
        "Prioritize this repository for deeper query instrumentation before any rewrite.",
    });
  }

  if (endpoint) {
    recommendations.push({
      impact: endpoint.writeIndicators > 0 ? "MEDIUM" : "LOW",
      area: "API_HOTSPOT",
      metric: endpoint.name,
      observedValue: `${endpoint.queryCount} DB usage indicator(s)`,
      recommendation:
        "Measure endpoint-level DB timing under controlled load before route-level optimization.",
    });
  }

  if (input.latency.averageMs !== null) {
    recommendations.push({
      impact: input.latency.averageMs >= 811 ? "HIGH" : "LOW",
      area: "OBSERVABILITY",
      metric: "average sampled DB latency vs Phase 19.0",
      observedValue: `${input.latency.averageMs}ms`,
      recommendation:
        "Keep this report as the authoritative Phase 19.2 baseline for before/after comparisons.",
    });
  }

  const impactScore = { HIGH: 3, MEDIUM: 2, LOW: 1 };

  return recommendations
    .sort((left, right) => impactScore[right.impact] - impactScore[left.impact])
    .slice(0, 10)
    .map((recommendation, index) => ({ rank: index + 1, ...recommendation }));
}

export async function getDatabasePerformanceReport(): Promise<DatabasePerformanceReport> {
  const started = performance.now();
  const measurements = await Promise.all(MEASUREMENTS.map(runMeasurement));
  const measurementIntervalMs = Math.max(1, round(performance.now() - started));
  const generatedAt = nowIso();
  const latency = summarizeLatency(measurements, measurementIntervalMs);
  const connections = getConnectionSummary(generatedAt);
  const transactions = summarizeTransactions(measurements, measurementIntervalMs);
  const slowQueries = buildSlowQueryReport(measurements, measurementIntervalMs);
  const repositoryHotspots = buildRepositoryHotspots(measurements);
  const apiHotspots = buildApiHotspots(measurements);
  const recommendations = buildRecommendations({
    latency,
    connections,
    transactions,
    slowQueries,
    repositoryHotspots,
    apiHotspots,
  });

  return {
    generatedAt,
    measurementOnly: true,
    measurementIntervalMs,
    officialBaseline: OFFICIAL_PHASE_19_0_BASELINE,
    latency,
    connections,
    transactions,
    slowQueries,
    repositoryHotspots,
    apiHotspots,
    measurements,
    recommendations,
    limitations: [
      "This phase intentionally performs read-only application sampling and static source analysis.",
      "Connection pool, lock wait, and native transaction telemetry are reported as unavailable unless read-only database-native views are exposed.",
      "No indexes, query rewrites, cache changes, migrations, or business behavior changes are performed.",
    ],
  };
}

export async function getDatabaseSlowQueryReport() {
  return (await getDatabasePerformanceReport()).slowQueries;
}

export async function getDatabaseConnectionSummary() {
  return (await getDatabasePerformanceReport()).connections;
}

export async function getDatabaseTransactionSummary() {
  return (await getDatabasePerformanceReport()).transactions;
}
