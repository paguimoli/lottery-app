import {
  controllerFailure,
  controllerSuccess,
} from "@/src/lib/controller/controller.types";
import {
  verifyIntegrityChain,
  verifyIntegrityRecord,
} from "./integrity.service";
import type {
  IntegrityEntityType,
  IntegrityVerifiableRecord,
} from "./integrity.types";

export function verifyIntegrityController({
  record,
  entityType,
  entityId,
}: {
  record?: IntegrityVerifiableRecord | null;
  entityType: IntegrityEntityType;
  entityId?: string;
}) {
  if (!record) {
    return controllerFailure("Integrity record is required.");
  }

  return controllerSuccess({
    result: verifyIntegrityRecord(record, entityType, entityId),
  });
}

export function verifyIntegrityChainController({
  records,
  entityType,
}: {
  records: IntegrityVerifiableRecord[];
  entityType: IntegrityEntityType;
}) {
  return controllerSuccess({
    results: verifyIntegrityChain(records, entityType),
  });
}
