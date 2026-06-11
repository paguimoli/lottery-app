import {
  failedResult,
  getStake,
  getTemporaryPayout,
  lossResult,
  pushResult,
  type SettlementEvaluationInput,
  winResult,
} from "./settlement-evaluator.types";

const elementMetricKeys = [
  "woodCount",
  "fireCount",
  "earthCount",
  "metalCount",
  "waterCount",
] as const;

export function evaluateElement(input: SettlementEvaluationInput) {
  if (!input.drawMetrics) {
    return failedResult({ reason: "Draw metrics are required." });
  }

  if (!input.wagerOption?.code) {
    return failedResult({ reason: "Wager option is required." });
  }

  const elementCounts = elementMetricKeys.map((metricKey) => ({
    code: metricKey.replace("Count", "").toLowerCase(),
    count: Number(input.drawMetrics?.[metricKey] || 0),
  }));
  const highestCount = Math.max(...elementCounts.map((element) => element.count));
  const highestElements = elementCounts.filter(
    (element) => element.count === highestCount
  );
  const metadata = {
    elementCounts,
    highestCount,
    highestElements: highestElements.map((element) => element.code),
    optionCode: input.wagerOption.code,
  };

  if (highestElements.length > 1) {
    return pushResult({
      reason: "Multiple elements tied for highest count.",
      metadata,
    });
  }

  if (input.wagerOption.code === highestElements[0]?.code) {
    return winResult({
      stake: getStake(input),
      payout: getTemporaryPayout(input),
      reason: "Element option matched highest element count.",
      metadata,
    });
  }

  return lossResult({
    stake: getStake(input),
    reason: "Element option did not match highest element count.",
    metadata,
  });
}
