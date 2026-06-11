import type { ComparisonOperator } from "../../wagers/wager.types";
import {
  failedResult,
  getStake,
  getTemporaryPayout,
  lossResult,
  type SettlementEvaluationInput,
  winResult,
} from "./settlement-evaluator.types";

export function compareValues(
  leftValue: number,
  operator: ComparisonOperator,
  rightValue: number
) {
  if (operator === ">") return leftValue > rightValue;
  if (operator === "<") return leftValue < rightValue;
  if (operator === ">=") return leftValue >= rightValue;
  if (operator === "<=") return leftValue <= rightValue;
  if (operator === "==") return leftValue === rightValue;
  if (operator === "!=") return leftValue !== rightValue;
  return false;
}

export function getNumericMetric(
  input: SettlementEvaluationInput,
  metricKey?: string
) {
  if (!input.drawMetrics || !metricKey) {
    return null;
  }

  const value = input.drawMetrics[metricKey as keyof typeof input.drawMetrics];

  return typeof value === "number" ? value : null;
}

export function evaluateMetricThreshold(input: SettlementEvaluationInput) {
  const metricValue = getNumericMetric(input, input.wagerType.metricKey);
  const operator = input.wagerType.comparisonOperator;
  const thresholdValue = input.wagerType.thresholdValue;

  if (metricValue === null || !operator || thresholdValue === null || thresholdValue === undefined) {
    return failedResult({
      reason: "Metric threshold configuration is incomplete.",
      metadata: {
        metricKey: input.wagerType.metricKey,
        operator,
        thresholdValue,
      },
    });
  }

  const matched = compareValues(metricValue, operator, Number(thresholdValue));
  const metadata = {
    metricKey: input.wagerType.metricKey,
    metricValue,
    operator,
    thresholdValue,
  };

  if (matched) {
    return winResult({
      stake: getStake(input),
      payout: getTemporaryPayout(input),
      reason: "Metric threshold condition matched.",
      metadata,
    });
  }

  return lossResult({
    stake: getStake(input),
    reason: "Metric threshold condition did not match.",
    metadata,
  });
}
