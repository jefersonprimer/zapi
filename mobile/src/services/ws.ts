const WS_URL = "ws://192.168.5.22:3000";

type MessageHandler = (msg: any) => void;

export class WsClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, MessageHandler[]>();
  private token: string;
  private chatId: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(token: string) {
    this.token = token;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(`${WS_URL}/ws?token=${this.token}`);

    this.ws.onopen = () => {
      if (this.chatId) {
        this.subscribe(this.chatId);
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const type = data.type;
        const handlers = this.handlers.get(type) ?? [];
        handlers.forEach((fn) => fn(data));
      } catch {}
    };

    this.ws.onclose = () => {
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.chatId) {
      this.unsubscribe(this.chatId);
      this.chatId = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  subscribe(chatId: string) {
    this.chatId = chatId;
    this.send({ type: "subscribe", chat_id: chatId });
  }

  unsubscribe(chatId: string) {
    this.send({ type: "unsubscribe", chat_id: chatId });
  }

  on(type: string, handler: MessageHandler) {
    const existing = this.handlers.get(type) ?? [];
    existing.push(handler);
    this.handlers.set(type, existing);
    return () => {
      const handlers = this.handlers.get(type)?.filter((h) => h !== handler);
      if (handlers && handlers.length > 0) {
        this.handlers.set(type, handlers);
      } else {
        this.handlers.delete(type);
      }
    };
  }

  private send(data: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }
}
