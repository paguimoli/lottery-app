import type { RetryPolicy } from "./worker.types";
import {
  classifyOutboxEventType,
  getQueueTopologyEntry,
} from "@/src/lib/queue/queue-topology";

export const defaultRetryPolicy: RetryPolicy = {
  maxAttempts: 5,
};

const BACKOFF_BY_ATTEMPT: Record<number, number> = {
  1: 60 * 1000,
  2: 5 * 60 * 1000,
  3: 15 * 60 * 1000,
  4: 60 * 60 * 1000,
};

export function shouldDeadLetter(attemptCount: number): boolean {
  return attemptCount >= defaultRetryPolicy.maxAttempts;
}

export function shouldDeadLetterOutboxEvent(
  eventType: string,
  attemptCount: number
): boolean {
  const category = classifyOutboxEventType(eventType);
  const policy = getQueueTopologyEntry(category).retryPolicy;

  return attemptCount >= policy.maxAttempts;
}

export function calculateNextAttemptAt(
  attemptCount: number,
  now: Date = new Date()
): Date | null {
  if (shouldDeadLetter(attemptCount)) {
    return null;
  }

  const backoffMs = BACKOFF_BY_ATTEMPT[attemptCount] ?? BACKOFF_BY_ATTEMPT[4];

  return new Date(now.getTime() + backoffMs);
}

export function calculateOutboxNextAttemptAt(
  eventType: string,
  attemptCount: number,
  now: Date = new Date()
): Date | null {
  const category = classifyOutboxEventType(eventType);
  const policy = getQueueTopologyEntry(category).retryPolicy;

  if (shouldDeadLetterOutboxEvent(eventType, attemptCount)) {
    return null;
  }

  const backoffSeconds =
    policy.backoffSeconds[Math.max(attemptCount - 1, 0)] ??
    policy.backoffSeconds[policy.backoffSeconds.length - 1] ??
    3600;

  return new Date(now.getTime() + backoffSeconds * 1000);
}
