import { NextResponse } from "next/server";

import {
  AuthMiddlewareError,
  requirePermission,
} from "@/src/domains/auth/auth-middleware";
import { getShadowEvidenceLifecycleEvents } from "@/src/domains/shadow-evidence-lifecycle/shadow-evidence-lifecycle.service";

export const runtime = "nodejs";

function authErrorResponse(error: AuthMiddlewareError) {
  return NextResponse.json({ success: false, error: error.message }, { status: error.status });
}

function emptyStatusCounts() {
  return {
    ACTIVE: 0,
    EXCLUDED_FROM_PROMOTION: 0,
    ARCHIVED: 0,
    REVIEW_REQUIRED: 0,
  };
}

function emptyReasonCounts() {
  return {
    QA_INTENTIONAL: 0,
    QA_FAILURE_TEST: 0,
    LOAD_TEST: 0,
    BACKFILL_TEST: 0,
    OPERATOR_EXCLUDED: 0,
    EXPIRED_TEST_EVIDENCE: 0,
    UNEXPLAINED: 0,
  };
}

export async function GET(request: Request) {
  try {
    await requirePermission(request, "system.admin");
    const events = (await getShadowEvidenceLifecycleEvents()).filter(
      (event) => event.domain === "LEDGER"
    );
    const latestByEvidence = new Map<string, (typeof events)[number]>();
    const reasonCounts = emptyReasonCounts();

    for (const event of events) {
      latestByEvidence.set(`${event.evidenceType}:${event.evidenceId}`, event);
      reasonCounts[event.reasonCode] += 1;
    }

    const effectiveStatusCounts = emptyStatusCounts();
    for (const event of latestByEvidence.values()) {
      effectiveStatusCounts[event.newStatus] += 1;
    }

    return NextResponse.json({
      success: true,
      summary: {
        domain: "LEDGER",
        totalEvents: events.length,
        effectiveStatusCounts,
        reasonCounts,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof AuthMiddlewareError) return authErrorResponse(error);

    return NextResponse.json(
      { success: false, error: "Unable to load ledger lifecycle summary." },
      { status: 500 }
    );
  }
}
