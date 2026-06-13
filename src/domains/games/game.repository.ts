import type { GameRecord } from "./game.types";

export function listGames<TGame>(games: TGame[]): TGame[] {
  return games;
}

export function findGameById<TGame extends GameRecord>(
  games: TGame[],
  gameId: string
): TGame | undefined {
  return games.find(
    (game) => game.id === gameId || game.externalId === gameId
  );
}

export function saveGame<TGame>(games: TGame[], game: TGame): TGame[] {
  return [...games, game];
}

export function updateGame<TGame>(
  games: TGame[],
  index: number,
  game: TGame
): TGame[] {
  return games.map((createdGame, createdIndex) =>
    createdIndex === index ? game : createdGame
  );
}
