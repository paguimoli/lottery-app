import {
  controllerFailure,
  controllerSuccess,
} from "@/src/lib/controller/controller.types";
import type { ControllerResult } from "@/src/lib/controller/controller.types";
import { saveGame, updateGame } from "./game.repository";
import { buildGamePayload } from "./game.service";
import type { GameRecord } from "./game.types";
import { validateGameForm } from "./game.validation";

type NormalizedGameControllerData<TGame> = {
  game: TGame;
};

type GameMutationControllerData<TGame> = {
  game: TGame;
  games: TGame[];
};

export function validateAndNormalizeGameController<TGame extends GameRecord = GameRecord>(
  form: unknown
): ControllerResult<NormalizedGameControllerData<TGame>> {
  const validation = validateGameForm(form);

  if (!validation.valid) {
    return controllerFailure(validation.errors);
  }

  const result = buildGamePayload<TGame>(form);

  if (!result.ok) {
    return controllerFailure(result.message);
  }

  return controllerSuccess({ game: result.payload });
}

export function createGameController<TGame extends GameRecord = GameRecord>({
  games,
  form,
}: {
  games: TGame[];
  form: unknown;
}): ControllerResult<GameMutationControllerData<TGame>> {
  const result = validateAndNormalizeGameController<TGame>(form);

  if (!result.success || !result.data) {
    return controllerFailure(result.errors || "Game validation failed.");
  }

  return controllerSuccess({
    game: result.data.game,
    games: saveGame(games, result.data.game),
  });
}

export function updateGameController<TGame extends GameRecord = GameRecord>({
  games,
  form,
  editingGameIndex,
}: {
  games: TGame[];
  form: unknown;
  editingGameIndex: number;
}): ControllerResult<GameMutationControllerData<TGame>> {
  const result = validateAndNormalizeGameController<TGame>(form);

  if (!result.success || !result.data) {
    return controllerFailure(result.errors || "Game validation failed.");
  }

  return controllerSuccess({
    game: result.data.game,
    games: updateGame(games, editingGameIndex, result.data.game),
  });
}
