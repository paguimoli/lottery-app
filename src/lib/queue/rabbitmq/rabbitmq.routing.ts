import {
  getQueueTopologyEntry,
  resolveQueueTopologyForEvent,
  type QueueWorkloadCategory,
} from "../queue-topology";

export type RabbitMqRouting = {
  exchange: string;
  routingKey: string;
  bindingKeys: string[];
  queue: string;
  deadLetterQueue: string;
  workloadCategory: QueueWorkloadCategory;
};

export function resolveRabbitMqRouting(eventType: string): RabbitMqRouting {
  const topology = resolveQueueTopologyForEvent(eventType);

  return {
    exchange: topology.exchange,
    routingKey: topology.routingKey,
    bindingKeys: [topology.routingKeyPattern],
    queue: topology.queueName,
    deadLetterQueue: topology.deadLetterQueueName,
    workloadCategory: topology.category,
  };
}

export function resolveRabbitMqWorkloadRouting(
  workloadCategory: QueueWorkloadCategory
): RabbitMqRouting {
  const topology = getQueueTopologyEntry(workloadCategory);

  return {
    exchange: topology.exchange,
    routingKey: topology.routingKeyPattern,
    bindingKeys: [topology.routingKeyPattern],
    queue: topology.queueName,
    deadLetterQueue: topology.deadLetterQueueName,
    workloadCategory: topology.category,
  };
}
