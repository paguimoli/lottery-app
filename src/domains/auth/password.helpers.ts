export type PasswordHashMetadata = {
  algorithm: "argon2id";
  hash: string;
  createdAt: string;
  version?: string | null;
};

export function isArgon2idPasswordHash(
  metadata?: Partial<PasswordHashMetadata> | null
) {
  return metadata?.algorithm === "argon2id" && Boolean(metadata.hash);
}

export function maskPasswordHash(hash: string) {
  if (hash.length <= 8) {
    return "********";
  }

  return `${hash.slice(0, 4)}...${hash.slice(-4)}`;
}

export function buildPasswordHashMetadata(input: {
  hash: string;
  createdAt?: string;
  version?: string | null;
}): PasswordHashMetadata {
  return {
    algorithm: "argon2id",
    hash: input.hash,
    createdAt: input.createdAt || new Date().toISOString(),
    version: input.version || null,
  };
}
