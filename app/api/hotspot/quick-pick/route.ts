import { NextResponse } from "next/server";

import { supabase } from "@/app/lib/supabaseClient";

type QuickPickRequestBody = {
  organizationExternalId?: string;
  playerExternalId?: string;
  gameExternalId?: string;
  spotCount?: number;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let body: QuickPickRequestBody;

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const spotCount = Number(body.spotCount);

  if (!Number.isInteger(spotCount) || spotCount < 1 || spotCount > 10) {
    return jsonError("spotCount must be an integer between 1 and 10.", 400);
  }

  let organizationId = null;
  let playerId = null;
  let gameId = null;

  if (body.organizationExternalId) {
    const { data: organization, error: organizationError } = await supabase
      .from("organizations")
      .select("id")
      .eq("external_organization_id", body.organizationExternalId)
      .maybeSingle();

    if (organizationError) {
      console.error("Quick Pick organization lookup failed:", organizationError);
    }

    organizationId = organization?.id || null;
  }

  if (body.playerExternalId && organizationId) {
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("external_player_id", body.playerExternalId)
      .maybeSingle();

    if (playerError) {
      console.error("Quick Pick player lookup failed:", playerError);
    }

    playerId = player?.id || null;
  }

  if (body.gameExternalId) {
    const { data: game, error: gameError } = await supabase
      .from("normalized_games")
      .select("id")
      .eq("external_id", body.gameExternalId)
      .maybeSingle();

    if (gameError) {
      console.error("Quick Pick game lookup failed:", gameError);
    }

    gameId = game?.id || null;
  }

  const { data, error } = await supabase.rpc("generate_hotspot_quick_pick", {
    p_spot_count: spotCount,
  });

  if (error) {
    console.error("Hot Spot quick pick RPC failed:", error);
    return jsonError("Hot Spot quick pick failed.", 500);
  }

  const numbers = Array.isArray(data) ? data.join("-") : String(data || "");

  const { error: auditError } = await supabase
    .from("quick_pick_audit_logs")
    .insert({
      organization_id: organizationId,
      player_id: playerId,
      game_id: gameId,
      game_type: "hotspot",
      spot_count: spotCount,
      generated_numbers: numbers,
      rng_method: "pgcrypto_fisher_yates",
      source_type: "api",
    });

  if (auditError) {
    console.error("Quick Pick audit insert failed:", auditError);
  }

  return NextResponse.json({
    spotCount,
    numbers,
  });
}
