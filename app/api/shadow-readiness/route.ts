import { NextResponse } from "next/server";

import {
  AuthMiddlewareError,
  requirePermission,
} from "@/src/domains/auth/auth-middleware";
import {
  getShadowReadinessSummary,
  parseShadowReadinessWindow,
} from "@/src/domains/shadow-readiness/shadow-readiness.service";

export const runtime = "nodejs";

function authErrorResponse(error: AuthMiddlewareError) {
  return NextResponse.json(
    {
      success: false,
      error: error.message,
    },
    { status: error.status }
  );
}

export async function GET(request: Request) {
  try {
    await requirePermission(request, "system.admin");
    const url = new URL(request.url);
    const window = parseShadowReadinessWindow(url.searchParams.get("window"));
    const readiness = await getShadowReadinessSummary(window);

    return NextResponse.json({
      success: true,
      readiness,
    });
  } catch (error) {
    if (error instanceof AuthMiddlewareError) {
      return authErrorResponse(error);
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unable to load shadow extraction readiness.",
      },
      { status: 500 }
    );
  }
}
