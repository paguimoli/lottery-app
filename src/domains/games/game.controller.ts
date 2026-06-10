import {
  controllerFailure,
  controllerSuccess,
} from "@/src/lib/controller/controller.types";
import { buildGamePayload } from "./game.service";
import { validateGameForm } from "./game.validation";

export function validateAndNormalizeGameController(form: any) {
  const validation = validateGameForm(form);

  if (!validation.valid) {
    return controllerFailure(validation.errors);
  }

  const result = buildGamePayload(form);

  if (!result.ok || !result.payload) {
    return controllerFailure(result.message);
  }

  return controllerSuccess({ game: result.payload });
}

export function createGameController({
  games,
  form,
}: {
  games: any[];
  form: any;
}) {
  const result = validateAndNormalizeGameController(form);

  if (!result.success || !result.data) {
    return result;
  }

  return controllerSuccess({
    game: result.data.game,
    games: [...games, result.data.game],
  });
}

export function updateGameController({
  games,
  form,
  editingGameIndex,
}: {
  games: any[];
  form: any;
  editingGameIndex: number;
}) {
  const result = validateAndNormalizeGameController(form);

  if (!result.success || !result.data) {
    return result;
  }

  return controllerSuccess({
    game: result.data.game,
    games: games.map((game, index) =>
      index === editingGameIndex ? result.data!.game : game
    ),
  });
}
