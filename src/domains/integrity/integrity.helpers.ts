import type {
  IntegrityCheckResult,
  IntegrityEntityType,
  IntegrityHashInput,
  IntegrityProtectedRecord,
  IntegrityVerifiableRecord,
} from "./integrity.types";

const EXCLUDED_INTEGRITY_FIELDS = new Set([
  "recordHash",
  "previousHash",
  "hashVersion",
  "signature",
  "signatureKeyId",
  "signatureVersion",
  "signedAt",
]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeForCanonicalJson(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeForCanonicalJson(item))
      .filter((item) => item !== undefined);
  }

  const output: Record<string, unknown> = {};

  for (const key of Object.keys(value).sort()) {
    if (EXCLUDED_INTEGRITY_FIELDS.has(key)) {
      continue;
    }

    const normalizedValue = normalizeForCanonicalJson(
      (value as Record<string, unknown>)[key]
    );

    if (normalizedValue !== undefined) {
      output[key] = normalizedValue;
    }
  }

  return output;
}

export function canonicalizePayload(payload: Record<string, unknown>) {
  return JSON.stringify(normalizeForCanonicalJson(payload));
}

function rightRotate(value: number, amount: number) {
  return (value >>> amount) | (value << (32 - amount));
}

function toUtf8Bytes(value: string) {
  return Array.from(new TextEncoder().encode(value));
}

export function generateSha256Hash(value: string) {
  const hashValues = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f,
    0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const roundConstants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b,
    0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
    0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7,
    0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152,
    0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
    0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
    0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
    0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f,
    0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const bytes = toUtf8Bytes(value);
  const bitLength = bytes.length * 8;

  bytes.push(0x80);

  while (bytes.length % 64 !== 56) {
    bytes.push(0);
  }

  for (let i = 7; i >= 0; i -= 1) {
    bytes.push((bitLength / Math.pow(2, i * 8)) & 0xff);
  }

  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = new Array<number>(64).fill(0);

    for (let i = 0; i < 16; i += 1) {
      const index = offset + i * 4;
      words[i] =
        ((bytes[index] << 24) |
          (bytes[index + 1] << 16) |
          (bytes[index + 2] << 8) |
          bytes[index + 3]) >>>
        0;
    }

    for (let i = 16; i < 64; i += 1) {
      const s0 =
        rightRotate(words[i - 15], 7) ^
        rightRotate(words[i - 15], 18) ^
        (words[i - 15] >>> 3);
      const s1 =
        rightRotate(words[i - 2], 17) ^
        rightRotate(words[i - 2], 19) ^
        (words[i - 2] >>> 10);

      words[i] =
        (words[i - 16] + s0 + words[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hashValues;

    for (let i = 0; i < 64; i += 1) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + choice + roundConstants[i] + words[i]) >>> 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hashValues[0] = (hashValues[0] + a) >>> 0;
    hashValues[1] = (hashValues[1] + b) >>> 0;
    hashValues[2] = (hashValues[2] + c) >>> 0;
    hashValues[3] = (hashValues[3] + d) >>> 0;
    hashValues[4] = (hashValues[4] + e) >>> 0;
    hashValues[5] = (hashValues[5] + f) >>> 0;
    hashValues[6] = (hashValues[6] + g) >>> 0;
    hashValues[7] = (hashValues[7] + h) >>> 0;
  }

  return hashValues
    .map((hashValue) => hashValue.toString(16).padStart(8, "0"))
    .join("");
}

export function buildIntegrityPayload(input: IntegrityHashInput) {
  return canonicalizePayload({
    chainPreviousHash: input.previousHash || null,
    entityId: input.entityId,
    entityType: input.entityType,
    integrityHashVersion: input.hashVersion || "1",
    payload: input.payload,
  });
}

export function generateRecordHash(input: IntegrityHashInput) {
  return generateSha256Hash(buildIntegrityPayload(input));
}

export function attachIntegrityHash<T extends object>(
  record: T,
  entityType: IntegrityEntityType,
  entityId: string,
  previousHash?: string | null,
  hashVersion = "1"
): T & IntegrityProtectedRecord {
  const recordWithChain = {
    ...(record as Record<string, unknown>),
    previousHash: previousHash || null,
    hashVersion,
  };
  const recordHash = generateRecordHash({
    entityType,
    entityId,
    payload: recordWithChain,
    previousHash: previousHash || null,
    hashVersion,
  });

  return {
    ...(record as T),
    previousHash: previousHash || null,
    hashVersion,
    recordHash,
  };
}

function getRecordEntityId(record: IntegrityVerifiableRecord, entityId?: string) {
  return entityId || String(record.id || record.entityId || "");
}

export function verifyRecordHash(
  record: IntegrityVerifiableRecord,
  entityType: IntegrityEntityType,
  entityId?: string
): IntegrityCheckResult {
  const resolvedEntityId = getRecordEntityId(record, entityId);

  if (!record.recordHash) {
    return {
      entityType,
      entityId: resolvedEntityId,
      status: "missing_hash",
      actualHash: null,
      expectedHash: null,
      previousHash: record.previousHash || null,
      message: "Record has no integrity hash.",
    };
  }

  const expectedHash = generateRecordHash({
    entityType,
    entityId: resolvedEntityId,
    payload: record,
    previousHash: record.previousHash || null,
    hashVersion: record.hashVersion || "1",
  });

  if (expectedHash !== record.recordHash) {
    return {
      entityType,
      entityId: resolvedEntityId,
      status: "invalid",
      actualHash: record.recordHash,
      expectedHash,
      previousHash: record.previousHash || null,
      message: "Record hash does not match canonical payload.",
    };
  }

  return {
    entityType,
    entityId: resolvedEntityId,
    status: "valid",
    actualHash: record.recordHash,
    expectedHash,
    previousHash: record.previousHash || null,
    message: "Record hash is valid.",
  };
}

export function verifyHashChain(
  records: IntegrityVerifiableRecord[],
  entityType: IntegrityEntityType
) {
  return records.map((record, index): IntegrityCheckResult => {
    const recordCheck = verifyRecordHash(record, entityType);

    if (recordCheck.status !== "valid") {
      return recordCheck;
    }

    if (index === 0) {
      return recordCheck;
    }

    const previousRecord = records[index - 1];
    const expectedPreviousHash = previousRecord.recordHash || null;

    if (!expectedPreviousHash || record.previousHash !== expectedPreviousHash) {
      return {
        ...recordCheck,
        status: "chain_broken",
        expectedHash: expectedPreviousHash,
        actualHash: record.previousHash || null,
        message: "Record previousHash does not match the prior record hash.",
      };
    }

    return recordCheck;
  });
}

export function hasRecordShape(value: unknown): value is Record<string, unknown> {
  return isPlainRecord(value);
}
