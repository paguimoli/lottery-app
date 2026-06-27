export type DatabaseTelemetryStatus = "READY" | "WARNING" | "UNAVAILABLE";

export type DatabaseQueryOperation =
  | "COUNT"
  | "SAMPLE_RECENT"
  | "SAMPLE_FILTERED"
  | "STATIC_ANALYSIS";

export type DatabaseQueryMeasurement = {
  id: string;
  label: string;
  table: string;
  operation: DatabaseQueryOperation;
  accessType: "READ" | "WRITE";
  repositoryMethod: string | null;
  endpoint: string | null;
  startedAt: string;
  completedAt: string;
  durationMs: number | null;
  rowCount: number | null;
  status: DatabaseTelemetryStatus;
  error: string | null;
};

export type DatabaseLatencySummary = {
  averageMs: number | null;
  medianMs: number | null;
  p95Ms: number | null;
  p99Ms: number | null;
  minMs: number | null;
  maxMs: number | null;
  queryCount: number;
  queriesPerSecond: number;
  readsPerSecond: number;
  writesPerSecond: number;
  readWriteRatio: string;
};

export type DatabaseConnectionSummary = {
  status: DatabaseTelemetryStatus;
  activeConnections: number | null;
  idleConnections: number | null;
  waitingConnections: number | null;
  concurrentConnections: number | null;
  poolUtilization: number | null;
  poolExhaustionEvents: number | null;
  source: "SUPABASE_REST_LIMITED" | "PG_STAT_ACTIVITY" | "UNAVAILABLE";
  limitations: string[];
  sampledAt: string;
};

export type DatabaseTransactionSummary = {
  status: DatabaseTelemetryStatus;
  transactionCount: number;
  transactionFrequencyPerSecond: number;
  averageTransactionDurationMs: number | null;
  maxTransactionDurationMs: number | null;
  longestRunningTransaction: {
    durationMs: number | null;
    startedAt: string | null;
    state: string | null;
  };
  concurrentTransactions: number | null;
  averageTransactionSizeRows: number | null;
  maxTransactionSizeRows: number | null;
  lockWaits: number | null;
  source: "APPLICATION_SAMPLED_READS" | "PG_STAT_ACTIVITY" | "UNAVAILABLE";
  limitations: string[];
};

export type SlowQueryBucket = {
  label: string;
  minMs: number;
  maxMs: number | null;
  count: number;
};

export type SlowQueryReport = {
  generatedAt: string;
  measurementIntervalMs: number;
  thresholdMs: number;
  histogram: SlowQueryBucket[];
  topSlowQueries: DatabaseQueryMeasurement[];
  topQueriedTables: Array<{
    table: string;
    queryCount: number;
    averageDurationMs: number | null;
    maxDurationMs: number | null;
  }>;
};

export type DatabaseHotspot = {
  rank: number;
  name: string;
  type: "REPOSITORY" | "API_ENDPOINT";
  queryCount: number;
  measuredAverageMs: number | null;
  measuredMaxMs: number | null;
  writeIndicators: number;
  readIndicators: number;
  evidence: string[];
};

export type DatabasePerformanceRecommendation = {
  rank: number;
  impact: "HIGH" | "MEDIUM" | "LOW";
  area:
    | "QUERY_LATENCY"
    | "CONNECTION_POOL"
    | "TRANSACTIONS"
    | "REPOSITORY_HOTSPOT"
    | "API_HOTSPOT"
    | "OBSERVABILITY";
  metric: string;
  observedValue: string;
  recommendation: string;
};

export type DatabasePerformanceReport = {
  generatedAt: string;
  measurementOnly: true;
  measurementIntervalMs: number;
  officialBaseline: {
    phase: "19.0";
    averageSampledDbLatencyMs: number;
    slowestSampledQueryMs: number;
    connectionPoolMetrics: "UNAVAILABLE";
    transactionDurationVisibility: "LIMITED";
  };
  latency: DatabaseLatencySummary;
  connections: DatabaseConnectionSummary;
  transactions: DatabaseTransactionSummary;
  slowQueries: SlowQueryReport;
  repositoryHotspots: DatabaseHotspot[];
  apiHotspots: DatabaseHotspot[];
  measurements: DatabaseQueryMeasurement[];
  recommendations: DatabasePerformanceRecommendation[];
  limitations: string[];
};
