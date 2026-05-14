import { db } from "@/lib/db";

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

export async function publishSse(event: EventPayload) {
  await db.sseEvent.create({
    data: {
      eventType: event.type,
      orderId: event.orderId,
      ts: BigInt(event.ts),
    },
  });
  globalBus.listeners?.forEach((listener) => listener(event));
}

export async function readSseEventsSince(sinceTs: number) {
  const rows = await db.sseEvent.findMany({
    where: {
      ts: {
        gt: BigInt(sinceTs),
      },
    },
    orderBy: { ts: "asc" },
    take: 100,
  });
  return rows.map((row) => ({
    type: row.eventType as EventPayload["type"],
    orderId: row.orderId,
    ts: Number(row.ts),
  }));
}
