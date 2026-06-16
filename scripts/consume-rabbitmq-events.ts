import { logger } from "@/src/lib/observability/logger";
import { RabbitMqQueueConsumer } from "@/src/lib/queue/rabbitmq/rabbitmq.consumer";
import { resolveRabbitMqRouting } from "@/src/lib/queue/rabbitmq/rabbitmq.routing";

async function main() {
  const routing = resolveRabbitMqRouting("cashier.transaction.completed");
  const consumer = new RabbitMqQueueConsumer();

  logger.info({
    message: "RabbitMQ dev consumer starting.",
    metadata: {
      queue: routing.queue,
      routingKey: routing.routingKey,
      exchange: routing.exchange,
    },
  });

  await consumer.consume({
    routing,
    handler: async (message) => {
      logger.info({
        message: "RabbitMQ consumed event payload.",
        correlationId: message.correlationId ?? null,
        metadata: {
          eventType: message.type,
          aggregateType: message.aggregateType ?? null,
          aggregateId: message.aggregateId ?? null,
          messageId: message.id ?? null,
          payload: message.payload,
        },
      });
    },
  });
}

main().catch((error) => {
  logger.error({
    message: "RabbitMQ dev consumer failed.",
    metadata: {
      error: error instanceof Error ? error.message : "Unknown error",
    },
  });

  process.exit(1);
});
