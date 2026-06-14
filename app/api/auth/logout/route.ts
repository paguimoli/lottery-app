import { NextResponse } from "next/server";

import { logoutController } from "@/src/domains/auth/auth.controller";

export const runtime = "nodejs";

function logoutSuccessResponse() {
  return NextResponse.json({ success: true });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return logoutSuccessResponse();
  }

  const result = await logoutController({
    body,
  });

  if (!result.success) {
    return logoutSuccessResponse();
  }

  return logoutSuccessResponse();
}
