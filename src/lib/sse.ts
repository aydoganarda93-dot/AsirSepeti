type EventPayload = {
  type: "order.changed" | "order.deleted";
  orderId: string;
  ts: number;
};

type Listener = (event: EventPayload) => void;

const globalBus = globalThis as unknown as {
  listeners?: Set<Listener>;
};

if (!globalBus.listeners) globalBus.listeners = new Set<Listener>();

export function subscribeSse(listener: Listener): () => void {
  globalBus.listeners?.add(listener);
  return () => globalBus.listeners?.delete(listener);
}

export function publishSse(event: EventPayload) {
  globalBus.listeners?.forEach((listener) => listener(event));
}
