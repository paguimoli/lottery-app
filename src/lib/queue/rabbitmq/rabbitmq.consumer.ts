import * as amqp from "amqplib";
import type { Channel, ChannelModel, ConsumeMessage } from "amqplib";

import { logger } from "@/src/lib/observability/logger";
import type { QueueMessage } from "../queue.types";
import { getRabbitMqQueueConfig } from "./rabbitmq.config";
import type { RabbitMqRouting } from "./rabbitmq.routing";

export type RabbitMqMessageHandler = (
  message: QueueMessage,
  rawMessage: ConsumeMessage
) => Promise<void>;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown RabbitMQ error.";
}

function getMessageMetadata(rawMessage: ConsumeMessage, message?: QueueMessage) {
  return {
    eventType:
      message?.type ?? String(rawMessage.properties.headers?.eventType ?? ""),
    aggregateType:
      message?.aggregateType ??
      String(rawMessage.properties.headers?.aggregateType ?? ""),
    aggregateId:
      message?.aggregateId ??
      String(rawMessage.properties.headers?.aggregateId ?? ""),
    routingKey: rawMessage.fields.routingKey,
    correlationId:
      message?.correlationId ?? rawMessage.properties.correlationId ?? null,
  };
}

export class RabbitMqQueueConsumer {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  async consume({
    routing,
    handler,
  }: {
    routing: RabbitMqRouting;
    handler: RabbitMqMessageHandler;
  }): Promise<void> {
    const channel = await this.getChannel();
    const config = getRabbitMqQueueConfig();

    await channel.assertExchange(routing.exchange, "topic", {
      durable: config.durable,
    });
    await channel.assertQueue(routing.deadLetterQueue, {
      durable: config.durable,
    });
    await channel.assertQueue(routing.queue, {
      durable: config.durable,
      deadLetterExchange: "",
      deadLetterRoutingKey: routing.deadLetterQueue,
    });
    for (const bindingKey of routing.bindingKeys) {
      await channel.bindQueue(routing.queue, routing.exchange, bindingKey);
    }
    await channel.prefetch(1);

    await channel.consume(
      routing.queue,
      async (rawMessage) => {
        if (!rawMessage) {
          return;
        }

        let message: QueueMessage;

        try {
          message = JSON.parse(
            rawMessage.content.toString()
          ) as QueueMessage;
        } catch (error) {
          const metadata = getMessageMetadata(rawMessage);

          logger.error({
            message: "RabbitMQ message parse failed.",
            correlationId: metadata.correlationId,
            metadata: {
              ...metadata,
              error: getErrorMessage(error),
            },
          });

          channel.nack(rawMessage, false, false);
          logger.warn({
            message: "RabbitMQ message rejected.",
            correlationId: metadata.correlationId,
            metadata,
          });
          return;
        }

        const metadata = getMessageMetadata(rawMessage, message);

        logger.info({
          message: "RabbitMQ message received.",
          correlationId: metadata.correlationId,
          metadata,
        });

        try {
          await handler(message, rawMessage);
          channel.ack(rawMessage);
          logger.info({
            message: "RabbitMQ message acknowledged.",
            correlationId: metadata.correlationId,
            metadata,
          });
        } catch (error) {
          logger.error({
            message: "RabbitMQ message handler failed.",
            correlationId: metadata.correlationId,
            metadata: {
              ...metadata,
              error: getErrorMessage(error),
            },
          });

          channel.nack(rawMessage, false, false);
          logger.warn({
            message: "RabbitMQ message rejected.",
            correlationId: metadata.correlationId,
            metadata,
          });
        }
      },
      {
        noAck: false,
      }
    );
  }

  private async getChannel(): Promise<Channel> {
    if (this.channel) {
      return this.channel;
    }

    const config = getRabbitMqQueueConfig();

    if (!config.connectionUrl) {
      throw new Error("RabbitMQ connection URL is not configured.");
    }

    this.connection = await amqp.connect(config.connectionUrl);
    this.channel = await this.connection.createChannel();

    return this.channel;
  }
}
