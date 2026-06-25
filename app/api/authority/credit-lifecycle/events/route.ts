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

export async function GET(request: Request) {
  try {
    await requirePermission(request, "system.admin");
    const events = (await getShadowEvidenceLifecycleEvents()).filter(
      (event) => event.domain === "CREDIT"
    );

    return NextResponse.json({
      success: true,
      lifecycleEvents: {
        domain: "CREDIT",
        events,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof AuthMiddlewareError) return authErrorResponse(error);

    return NextResponse.json(
      { success: false, error: "Unable to load credit lifecycle events." },
      { status: 500 }
    );
  }
}
