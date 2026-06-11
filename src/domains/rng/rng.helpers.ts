export function generateRngRequestId() {
  return `RNG-REQUEST-${Date.now()}`;
}

export function generateRngResultId() {
  return `RNG-RESULT-${Date.now()}`;
}

export function generateRngProviderId() {
  return `RNG-PROVIDER-${Date.now()}`;
}

export function generateRngIdempotencyKey({
  providerId,
  gameId,
  drawingId,
}: {
  providerId: string;
  gameId: string;
  drawingId: string;
}) {
  return `${providerId}:${gameId}:${drawingId}`.toUpperCase();
}

export function validateKenoWinningNumbers({
  winningNumbers,
  expectedDrawCount,
  numberPoolMin = 1,
  numberPoolMax = 80,
}: {
  winningNumbers: number[];
  expectedDrawCount?: number | null;
  numberPoolMin?: number;
  numberPoolMax?: number;
}) {
  if (!Array.isArray(winningNumbers) || winningNumbers.length === 0) {
    return false;
  }

  if (expectedDrawCount && winningNumbers.length !== expectedDrawCount) {
    return false;
  }

  const uniqueNumbers = new Set(winningNumbers);

  if (uniqueNumbers.size !== winningNumbers.length) {
    return false;
  }

  return winningNumbers.every(
    (number) =>
      Number.isInteger(number) &&
      number >= numberPoolMin &&
      number <= numberPoolMax
  );
}

export function validateBullseyeInWinningNumbers({
  winningNumbers,
  bullseyeNumber,
}: {
  winningNumbers: number[];
  bullseyeNumber?: number | null;
}) {
  if (bullseyeNumber === null || bullseyeNumber === undefined) {
    return true;
  }

  return winningNumbers.includes(bullseyeNumber);
}
