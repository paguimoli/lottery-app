import {
  failedResult,
  getStake,
  getTemporaryPayout,
  lossResult,
  type SettlementEvaluationInput,
  winResult,
} from "./settlement-evaluator.types";

export function getDragonTigerResult({
  dragonDigit,
  tigerDigit,
}: {
  dragonDigit: number;
  tigerDigit: number;
}) {
  if (dragonDigit > tigerDigit) return "dragon";
  if (tigerDigit > dragonDigit) return "tiger";
  return "dt_tie";
}

export function evaluateDragonTiger(input: SettlementEvaluationInput) {
  if (!input.drawMetrics) {
    return failedResult({ reason: "Draw metrics are required." });
  }

  if (!input.wagerOption?.code) {
    return failedResult({ reason: "Wager option is required." });
  }

  const result = getDragonTigerResult({
    dragonDigit: input.drawMetrics.dragonDigit,
    tigerDigit: input.drawMetrics.tigerDigit,
  });
  const optionCode = input.wagerOption.code;
  const metadata = {
    dragonDigit: input.drawMetrics.dragonDigit,
    tigerDigit: input.drawMetrics.tigerDigit,
    dragonTigerResult: result,
    optionCode,
  };

  if (optionCode === result) {
    return winResult({
      stake: getStake(input),
      payout: getTemporaryPayout(input),
      reason: "Dragon/Tiger option matched result.",
      metadata,
    });
  }

  return lossResult({
    stake: getStake(input),
    reason: "Dragon/Tiger option did not match result.",
    metadata,
  });
}
