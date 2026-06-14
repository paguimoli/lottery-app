import { createClient } from "@supabase/supabase-js";
import type {
  WebSocketLike,
  WebSocketLikeConstructor,
} from "@supabase/realtime-js";
import WebSocket from "ws";
import {
  IDENTITY_CLASSES,
  USER_STATUSES,
} from "../src/domains/auth/auth.constants";
import { hashPassword } from "../src/domains/auth/password.helpers";
import { validatePasswordPolicy } from "../src/domains/auth/password.policy";
import { validateEmail, validateUsername } from "../src/domains/auth/auth.validation";

type BootstrapArgs = {
  username: string;
  email: string;
  passwordEnvName: string;
};

type PlatformUserRow = {
  id: string;
  username: string;
  email: string;
};

type UserGroupRow = {
  id: string;
  name: string;
};

type SupabaseDiagnosticError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

const DEFAULT_PASSWORD_ENV_NAME = "BOOTSTRAP_PLATFORM_OPERATOR_PASSWORD";
const SUPER_ADMIN_GROUP_NAME = "Super Admin";

class NodeWebSocketTransport implements WebSocketLike {
  readonly CONNECTING = WebSocket.CONNECTING;
  readonly OPEN = WebSocket.OPEN;
  readonly CLOSING = WebSocket.CLOSING;
  readonly CLOSED = WebSocket.CLOSED;

  onopen: ((this: WebSocketLike, ev: Event) => unknown) | null = null;
  onmessage: ((this: WebSocketLike, ev: MessageEvent) => unknown) | null = null;
  onclose: ((this: WebSocketLike, ev: CloseEvent) => unknown) | null = null;
  onerror: ((this: WebSocketLike, ev: Event) => unknown) | null = null;

  private readonly socket: WebSocket;
  private readonly eventTarget = new EventTarget();

  constructor(address: string | URL, subprotocols?: string | string[]) {
    this.socket = new WebSocket(address, subprotocols);

    this.socket.on("open", () => {
      const event = new Event("open");

      this.onopen?.call(this, event);
      this.eventTarget.dispatchEvent(event);
    });

    this.socket.on("message", (data) => {
      const event = new MessageEvent("message", {
        data: data.toString(),
      });

      this.onmessage?.call(this, event);
      this.eventTarget.dispatchEvent(event);
    });

    this.socket.on("close", (code, reason) => {
      const event = Object.assign(new Event("close"), {
        code,
        reason: reason.toString(),
        wasClean: code === 1000,
      }) as CloseEvent;

      this.onclose?.call(this, event);
      this.eventTarget.dispatchEvent(event);
    });

    this.socket.on("error", () => {
      const event = new Event("error");

      this.onerror?.call(this, event);
      this.eventTarget.dispatchEvent(event);
    });
  }

  get readyState() {
    return this.socket.readyState;
  }

  get url() {
    return this.socket.url;
  }

  get protocol() {
    return this.socket.protocol;
  }

  get binaryType() {
    return this.socket.binaryType;
  }

  set binaryType(value: string | undefined) {
    if (value === "arraybuffer" || value === "nodebuffer" || value === "fragments") {
      this.socket.binaryType = value;
    }
  }

  get bufferedAmount() {
    return this.socket.bufferedAmount;
  }

  get extensions() {
    return this.socket.extensions;
  }

  close(code?: number, reason?: string): void {
    this.socket.close(code, reason);
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    this.socket.send(data as Parameters<WebSocket["send"]>[0]);
  }

  addEventListener(type: string, listener: EventListener): void {
    this.eventTarget.addEventListener(type, listener);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.eventTarget.removeEventListener(type, listener);
  }
}

const realtimeTransport: WebSocketLikeConstructor = NodeWebSocketTransport;

function getArgValue(args: string[], name: string) {
  const flagIndex = args.indexOf(name);

  if (flagIndex < 0) {
    return null;
  }

  return args[flagIndex + 1] || null;
}

function parseArgs(args: string[]): BootstrapArgs {
  const username = getArgValue(args, "--username")?.trim();
  const email = getArgValue(args, "--email")?.trim();
  const passwordEnvName =
    getArgValue(args, "--password-env")?.trim() || DEFAULT_PASSWORD_ENV_NAME;

  if (!username || !email) {
    throw new Error(
      "Usage: create-platform-operator --username <username> --email <email> [--password-env BOOTSTRAP_PLATFORM_OPERATOR_PASSWORD]"
    );
  }

  return {
    username,
    email,
    passwordEnvName,
  };
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function validateBootstrapInput({
  username,
  email,
  password,
}: {
  username: string;
  email: string;
  password: string;
}) {
  const usernameValidation = validateUsername(username);

  if (!usernameValidation.valid) {
    throw new Error(usernameValidation.errors.join(" "));
  }

  const emailValidation = validateEmail(email);

  if (!emailValidation.valid) {
    throw new Error(emailValidation.errors.join(" "));
  }

  const passwordValidation = validatePasswordPolicy({
    password,
    username,
    email,
  });

  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.errors.join(" "));
  }
}

function printSupabaseErrorDiagnostics(
  label: string,
  error: SupabaseDiagnosticError
) {
  console.error(`${label} failed.`);

  if (error.message) {
    console.error(`Supabase message: ${error.message}`);
  }

  if (error.code) {
    console.error(`Supabase code: ${error.code}`);
  }

  if (error.details) {
    console.error(`Supabase details: ${error.details}`);
  }

  if (error.hint) {
    console.error(`Supabase hint: ${error.hint}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const password = getRequiredEnv(args.passwordEnvName);
  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseServiceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required.");
  }

  validateBootstrapInput({
    username: args.username,
    email: args.email,
    password,
  });

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      transport: realtimeTransport,
    },
  });

  const { data: existingUsername, error: existingUsernameError } = await supabase
    .from("platform_users")
    .select("id, username, email")
    .eq("username", args.username)
    .maybeSingle();

  if (existingUsernameError) {
    printSupabaseErrorDiagnostics(
      "Platform username existence check",
      existingUsernameError
    );
    throw new Error("Unable to check existing platform username.");
  }

  if (existingUsername) {
    throw new Error("A platform user with that username already exists.");
  }

  const { data: existingEmail, error: existingEmailError } = await supabase
    .from("platform_users")
    .select("id, username, email")
    .eq("email", args.email)
    .maybeSingle();

  if (existingEmailError) {
    printSupabaseErrorDiagnostics(
      "Platform email existence check",
      existingEmailError
    );
    throw new Error("Unable to check existing platform email.");
  }

  if (existingEmail) {
    throw new Error("A platform user with that email already exists.");
  }

  const { data: superAdminGroup, error: groupError } = await supabase
    .from("user_groups")
    .select("id, name")
    .eq("name", SUPER_ADMIN_GROUP_NAME)
    .maybeSingle();

  if (groupError) {
    printSupabaseErrorDiagnostics("Super Admin group lookup", groupError);
    throw new Error("Unable to load the Super Admin group.");
  }

  if (!superAdminGroup) {
    throw new Error("Super Admin group was not found. Run auth migrations first.");
  }

  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  const { data: createdUser, error: createUserError } = await supabase
    .from("platform_users")
    .insert({
      username: args.username,
      email: args.email,
      display_name: args.username,
      identity_class: IDENTITY_CLASSES.PLATFORM_OPERATOR,
      status: USER_STATUSES.ACTIVE,
      password_hash: passwordHash,
      mfa_enabled: false,
      failed_login_attempts: 0,
      last_password_change_at: now,
    })
    .select("id, username, email")
    .single();

  if (createUserError || !createdUser) {
    if (createUserError) {
      printSupabaseErrorDiagnostics("Platform user insert", createUserError);
    }

    throw new Error("Unable to create platform operator.");
  }

  const user = createdUser as PlatformUserRow;
  const group = superAdminGroup as UserGroupRow;

  const { error: membershipError } = await supabase
    .from("user_group_memberships")
    .upsert(
      {
        user_id: user.id,
        group_id: group.id,
      },
      { onConflict: "user_id,group_id" }
    );

  if (membershipError) {
    printSupabaseErrorDiagnostics(
      "Super Admin group membership insert",
      membershipError
    );
    throw new Error("Platform operator was created, but group assignment failed.");
  }

  console.log("Platform operator created successfully.");
  console.log(`Username: ${user.username}`);
  console.log(`Email: ${user.email}`);
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : "Platform operator bootstrap failed.";

  console.error(message);
  process.exit(1);
});
