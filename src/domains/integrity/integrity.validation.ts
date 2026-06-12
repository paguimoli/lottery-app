import type { ValidationResult } from "@/src/lib/validation/validation.types";
import type { IntegrityHashInput } from "./integrity.types";
import { hasRecordShape } from "./integrity.helpers";

export function validateIntegrityHashInput(
  input: Partial<IntegrityHashInput>
): ValidationResult {
  const errors: string[] = [];

  if (!input.entityType) {
    errors.push("Integrity entity type is required.");
  }

  if (!input.entityId) {
    errors.push("Integrity entity id is required.");
  }

  if (!hasRecordShape(input.payload)) {
    errors.push("Integrity payload is required.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
