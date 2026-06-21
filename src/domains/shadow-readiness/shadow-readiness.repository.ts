import { supabaseServerAdmin } from "@/src/lib/supabase/server-admin-client";
import type {
  ShadowDomainRawMetrics,
  ShadowDomainTableConfig,
  ShadowReadinessWindow,
} from "./shadow-readiness.types";

export class ShadowReadinessRepositoryError extends Error {
  constructor(message = "Shadow readiness query failed.") {
    super(message);
    this.name = "ShadowReadinessRepositoryError";
  }
}

function getWindowStart(window: ShadowReadinessWindow): string | null {
  if (window === "all") return null;

  const now = Date.now();
  const durationMs =
    window === "24h"
      ? 24 * 60 * 60 * 1000
      : window === "7d"
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;

  return new Date(now - durationMs).toISOString();
}

function sanitizeSupabaseError(error: { message?: string; code?: string }) {
  const code = error.code ? `${error.code}: ` : "";

  return `${code}${error.message ?? "Unknown Supabase error."}`;
}

async function selectRows<T>(
  table: string,
  columns: string,
  windowStart: string | null
): Promise<T[]> {
  let query = supabaseServerAdmin
    .from(table)
    .select(columns)
    .order("created_at", { ascending: false })
    .limit(10000);

  if (windowStart) {
    query = query.gte("created_at", windowStart);
  }

  const { data, error } = await query;

  if (error) {
    throw new ShadowReadinessRepositoryError(sanitizeSupabaseError(error));
  }

  return (data ?? []) as T[];
}

export async function fetchShadowDomainRawMetrics({
  config,
  window,
}: {
  config: ShadowDomainTableConfig;
  window: ShadowReadinessWindow;
}): Promise<ShadowDomainRawMetrics> {
  const windowStart = getWindowStart(window);
  const [runs, failures, mismatches] = await Promise.all([
    selectRows<{ comparison_status: "MATCH" | "MISMATCH" | "NOT_COMPARED" }>(
      config.runTable,
      "comparison_status, created_at",
      windowStart
    ),
    selectRows<{ id: string }>(config.failureTable, "id, created_at", windowStart),
    selectRows<{ severity: "INFO" | "WARNING" | "CRITICAL" }>(
      config.mismatchTable,
      "severity, created_at",
      windowStart
    ),
  ]);

  return { runs, failures, mismatches };
}
