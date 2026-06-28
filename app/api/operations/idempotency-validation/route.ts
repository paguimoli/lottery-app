import { NextResponse } from "next/server";

import {
  AuthMiddlewareError,
  requirePermission,
} from "@/src/domains/auth/auth-middleware";
import { getIdempotencyValidation } from "@/src/domains/resilience-engineering/resilience-engineering.service";

export const runtime = "nodejs";

function authErrorResponse(error: AuthMiddlewareError) {
  return NextResponse.json(
    { success: false, error: error.message },
    { status: error.status }
  );
}

export async function GET(request: Request) {
  try {
    await requirePermission(request, "system.admin");
    const idempotencyValidation = await getIdempotencyValidation();

    return NextResponse.json({ success: true, idempotencyValidation });
  } catch (error) {
    if (error instanceof AuthMiddlewareError) return authErrorResponse(error);

    return NextResponse.json(
      { success: false, error: "Unable to load idempotency validation." },
      { status: 500 }
    );
  }
}
