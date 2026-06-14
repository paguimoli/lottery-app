import { supabaseServerAdmin } from "../src/lib/supabase/server-admin-client";
import { verifyPassword } from "../src/domains/auth/password.helpers";

type PlatformPasswordRow = {
  username: string;
  password_hash?: string | null;
};

const PASSWORD_ENV_NAME = "VERIFY_PLATFORM_PASSWORD";

function getArgValue(args: string[], name: string) {
  const flagIndex = args.indexOf(name);

  if (flagIndex < 0) {
    return null;
  }

  return args[flagIndex + 1] || null;
}

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

async function main() {
  const username = getArgValue(process.argv.slice(2), "--username")?.trim();

  if (!username) {
    throw new Error("Usage: verify-platform-password --username <username>");
  }

  const password = getRequiredEnv(PASSWORD_ENV_NAME);

  const { data, error } = await supabaseServerAdmin
    .from("platform_users")
    .select("username, password_hash")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load platform user.");
  }

  const user = data as PlatformPasswordRow | null;
  const passwordHash = user?.password_hash ?? null;
  const verifyResult = passwordHash
    ? await verifyPassword(password, passwordHash)
    : false;

  console.log(`username: ${username}`);
  console.log(`user found: ${user ? "yes" : "no"}`);
  console.log(`has password hash: ${passwordHash ? "yes" : "no"}`);
  console.log(`verify result: ${verifyResult}`);
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : "Platform password verification failed.";

  console.error(message);
  process.exit(1);
});
