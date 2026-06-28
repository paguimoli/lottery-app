import { NextResponse } from "next/server";

import {
  AuthMiddlewareError,
  requirePermission,
} from "@/src/domains/auth/auth-middleware";
import { simulateFaultInjection } from "@/src/domains/resilience-engineering/resilience-engineering.service";

export const runtime = "nodejs";

function authErrorResponse(error: AuthMiddlewareError) {
  return NextResponse.json(
    { success: false, error: error.message },
    { status: error.status }
  );
}

export async function POST(request: Request) {
  try {
    await requirePermission(request, "system.admin");
    const payload = (await request.json()) as Record<string, unknown>;
    const faultInjectionSimulation = await simulateFaultInjection({
      drill: typeof payload.drill === "string" ? payload.drill : "",
      confirmed: payload.confirm === true || payload.confirmed === true,
    });

    return NextResponse.json({ success: true, faultInjectionSimulation });
  } catch (error) {
    if (error instanceof AuthMiddlewareError) return authErrorResponse(error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to simulate fault injection.",
      },
      { status: 400 }
    );
  }
}
