import type { TicketStatus } from "./ticket.types";

export function generateTicketNumber() {
  return `TICKET-${Date.now()}`;
}

export function isOpenTicketStatus(status: TicketStatus) {
  return status === "pending" || status === "accepted";
}

export function parseTicketSelectedNumbers(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return undefined;
  }

  const numbers = trimmedValue
    .split(/[,-]/)
    .map((number) => Number(number.trim()))
    .filter((number) => Number.isInteger(number));

  return numbers.length > 0 ? numbers : undefined;
}
