import { createClient } from "@supabase/supabase-js";
import type {
  WebSocketLike,
  WebSocketLikeConstructor,
} from "@supabase/realtime-js";
import WebSocket from "ws";

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
    if (
      value === "arraybuffer" ||
      value === "nodebuffer" ||
      value === "fragments"
    ) {
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

function getServerEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error("Supabase server admin client is not configured.");
  }

  return value;
}

function createServerAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("Supabase server admin client is server-only.");
  }

  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (!supabaseUrl) {
    throw new Error("Supabase server admin client is not configured.");
  }

  return createClient(supabaseUrl, getServerEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      transport: realtimeTransport,
    },
  });
}

export const supabaseServerAdmin = createServerAdminClient();
