const appUrl = process.env.OPS_APP_URL || process.env.QA_APP_URL || "http://localhost:3000";
const sessionToken =
  process.env.OPS_ADMIN_SESSION_TOKEN || process.env.QA_ADMIN_SESSION_TOKEN;

function fail(message, metadata = {}) {
  console.error(message);

  for (const [key, value] of Object.entries(metadata)) {
    console.error(`${key}: ${value}`);
  }

  process.exit(1);
}

async function main() {
  if (!sessionToken) {
    fail("OPS_ADMIN_SESSION_TOKEN or QA_ADMIN_SESSION_TOKEN is required.");
  }

  const response = await fetch(`${appUrl}/api/operations/queues/health`, {
    headers: {
      authorization: `Bearer ${sessionToken}`,
    },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.success) {
    fail("Queue health endpoint failed.", {
      status: response.status,
      error: payload.error ?? "unknown",
    });
  }

  const { health } = payload;

  console.log(`generatedAt: ${health.generatedAt}`);
  console.log(`exchange: ${health.exchange}`);
  console.log(`outboxPending: ${health.outbox.pendingCount}`);
  console.log(`outboxFailed: ${health.outbox.failedCount}`);
  console.log(`outboxDeadLetter: ${health.outbox.deadLetterCount}`);
  console.log(
    `oldestUnpublishedAgeSeconds: ${health.outbox.oldestUnpublishedAgeSeconds ?? "none"}`
  );
  console.log(`failedJobCount: ${health.outbox.failedJobCount}`);

  for (const queue of health.rabbitmq) {
    console.log(
      [
        queue.category,
        `queue=${queue.queueName}`,
        `ready=${queue.messagesReady ?? "unavailable"}`,
        `unacked=${queue.messagesUnacked ?? "unavailable"}`,
        `dlqReady=${queue.deadLetterMessagesReady ?? "unavailable"}`,
        `available=${queue.available}`,
      ].join(" ")
    );
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : "Queue health check failed.");
});
